// Dev-only: verifies the PDF export surface (issue #16) that is checkable
// without a browser binary — HTTP-level only, no Chromium. Covers:
//   - the internal print route's token gate (no/invalid token → 404),
//   - the print route rendering the issue HTML (the exact input Chromium prints)
//     when given the valid token, and 404 for an unpublished/unknown issue,
//   - the download endpoint's members-only gate (signed out → 403 JSON),
//   - the owner's site-wide download switch (issue #162): with it off, a
//     *signed-in member* is refused too, and the internal print route still
//     renders (turning downloads off is a distribution choice, not a rendering
//     one — the owner's next issue must still print),
//   - the sponsor segment of the cache key (issue #180), watched through the
//     stamp the print route renders it into — see that section for why the two
//     are the same value.
// It derives the internal print token the same way the app does, from
// AUTH_SECRET in .env.local. Requires a running dev server and the seed's
// published issue number 3.
//
// The switch check writes to the shared dev database (settings.pdf_downloads_
// enabled, through the same upsert the app uses, so it works on a database that
// has never saved settings) and mints a throwaway session. Both are undone in a
// finally, restoring exactly the state found — the column back to the value it
// held (true, false or NULL), or the whole row dropped if the check created it —
// so a failed run never leaves a site with its downloads switched either way
// against the owner's choice.
//
// What it deliberately does NOT do: launch Chromium or drive the authenticated
// generate→cache→serve path — that needs a real browser (forbidden here);
// verify those in the manual pass (see the issue report).
// Run: npx tsx scripts/dev-pdf-gate.mts <base-url>
import { createHash, randomUUID } from "node:crypto";
import postgres from "postgres";

process.loadEnvFile?.(".env.local");
const [base] = process.argv.slice(2);
if (!base) throw new Error("usage: dev-pdf-gate.mts <base-url>");

const secret = process.env.AUTH_SECRET;
if (!secret) throw new Error("AUTH_SECRET missing from .env.local");
const token = createHash("sha256").update(`${secret}:pdf-print`).digest("hex");

const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
};

const ISSUE = 3; // seed's published issue

// The `.pdf-page` sheet class is the tell that the print document actually
// rendered the issue. `notFound()` returns the standard Next not-found page —
// which carries no issue content — so its absence is what "cannot fetch the
// print route" means here. (Next 15 streams the layout shell before the async
// page runs, so a notFound() page responds 200 with the 404 body rather than a
// 404 status — an app-wide behavior; the guarantee is content-absence, asserted
// below, not the status line.)
const rendered = (html: string) => html.includes("pdf-page");

// 1. Print route without a token serves no issue content.
{
  const res = await fetch(`${base}/read/${ISSUE}/print`, {
    redirect: "manual",
  });
  ok(
    !rendered(await res.text()),
    "no token: print route serves no issue content",
  );
}

// 2. A wrong token is likewise rejected — no content.
{
  const res = await fetch(`${base}/read/${ISSUE}/print?token=wrong`, {
    redirect: "manual",
  });
  ok(
    !rendered(await res.text()),
    "bad token: print route serves no issue content",
  );
}

// 3. The valid token renders the print document — the fixed-canvas HTML Chromium
//    consumes. Assert the page-break scaffolding, the @page canvas size and real
//    themed content are all present (proves BlockView/PageFrame rendered).
{
  const res = await fetch(`${base}/read/${ISSUE}/print?token=${token}`, {
    redirect: "manual",
  });
  ok(res.status === 200, `valid token: print route → 200 (got ${res.status})`);
  const html = await res.text();
  ok(
    rendered(html),
    "valid token: print HTML carries per-page sheets (.pdf-page)",
  );
  ok(
    html.includes("@page"),
    "valid token: print HTML sets the @page canvas size",
  );
  ok(
    /No\.\s*3|font-newsreader|font-serif/.test(html),
    "valid token: print HTML rendered issue chrome/fonts (not an empty page)",
  );
}

// 4. The theme param reaches the renderer (the PDF cache keys each theme as its
//    own artifact). Classic page chrome carries the double `border-page-frame`
//    rules; Modern replaces them with the accent spine — so the marker's
//    presence/absence tells the themes apart without diffing whole documents
//    (which always differ via the per-request CSP nonce).
{
  const classic = await fetch(`${base}/read/${ISSUE}/print?token=${token}`);
  const modern = await fetch(
    `${base}/read/${ISSUE}/print?token=${token}&theme=modern`,
  );
  const [classicHtml, modernHtml] = await Promise.all([
    classic.text(),
    modern.text(),
  ]);
  ok(
    classicHtml.includes("border-page-frame"),
    "default theme: print renders classic page chrome",
  );
  ok(rendered(modernHtml), "theme=modern: print route renders");
  ok(
    !modernHtml.includes("border-page-frame"),
    "theme=modern: print drops the classic page chrome",
  );
}

// 5. An unpublished / unknown issue serves no content even with a valid token.
{
  const res = await fetch(`${base}/read/999999/print?token=${token}`, {
    redirect: "manual",
  });
  ok(
    !rendered(await res.text()),
    "unknown issue: print route serves no content",
  );
}

// 6. The download endpoint is members-only: a signed-out request is refused with
//    a 403 JSON body — a legible error, never a redirect or a hung generation.
{
  const res = await fetch(`${base}/api/issues/${ISSUE}/pdf`, {
    redirect: "manual",
  });
  ok(res.status === 403, `signed-out PDF download → 403 (got ${res.status})`);
  const body = (await res.json()) as { error?: string };
  ok(typeof body.error === "string", "403 carries a JSON error message");
}

// 7. The owner's site-wide switch (issue #162). A signed-in member sails past
//    the members-only gate above, so this is the only way to prove the switch
//    itself refuses rather than the session doing the work.
{
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const sessionToken = randomUUID();

  // The switch as found *before* this check writes anything — both whether a
  // settings row exists at all and, if it does, the value it holds — read
  // outside the try so the restore below always knows exactly what to put back.
  // A database that has never saved settings has no row at all, and an UPDATE
  // against it would quietly affect nothing — the assertions would then read as
  // "the switch doesn't work" on a perfectly healthy fresh clone. (If this read
  // itself fails, nothing has been written yet, so crashing here leaves the
  // database untouched — better than guessing what to restore.)
  // (Aliased: this client runs without a column-name transform, so the key comes
  // back exactly as named here.)
  const [existingRow] = await sql<{ found: boolean | null }[]>`
    select pdf_downloads_enabled as found from settings where id = 1`;
  const rowPreexisted = Boolean(existingRow);
  const foundValue = existingRow?.found ?? null;

  // Writes the switch the way the app does — an upsert on the fixed singleton
  // id (cf. updateSettings in src/server/settings.ts), so the row is created if
  // this is a database nobody has saved settings on yet.
  const setDownloads = (value: boolean | null) => sql`
    insert into settings (id, pdf_downloads_enabled)
    values (1, ${value})
    on conflict (id) do update set pdf_downloads_enabled = ${value}`;

  try {
    const [member] = await sql<{ id: string }[]>`
      select id from users order by created_at limit 1`;
    ok(member, "a member exists to sign in as");
    await sql`
      insert into sessions (session_token, user_id, expires)
      values (${sessionToken}, ${member!.id}, now() + interval '1 hour')`;
    const cookie = { Cookie: `authjs.session-token=${sessionToken}` };

    // Baseline: unconfigured, which is the shipped default and serves the
    // member. Not a 200 — that would generate a PDF, which needs Chromium — but
    // it must get past the two 403s, so anything other than 403 is the pass.
    // "Unconfigured" on a fresh database means no row at all, the strongest form
    // of the assertion, so don't create one just to hold a NULL: only clear the
    // column when a row is already there. Clearing it is what the baseline is
    // *for* — whatever the owner had set is put back by the finally, not here.
    if (rowPreexisted) await setDownloads(null);
    const onRes = await fetch(`${base}/api/issues/${ISSUE}/pdf`, {
      headers: cookie,
      redirect: "manual",
    });
    ok(
      onRes.status !== 403,
      `downloads on (unconfigured = default): member is not refused (got ${onRes.status})`,
    );

    await setDownloads(false);
    const offRes = await fetch(`${base}/api/issues/${ISSUE}/pdf`, {
      headers: cookie,
      redirect: "manual",
    });
    ok(
      offRes.status === 403,
      `downloads off: signed-in member → 403 (got ${offRes.status})`,
    );
    const offBody = (await offRes.json()) as { error?: string };
    ok(
      typeof offBody.error === "string",
      "downloads off: 403 carries a JSON error message",
    );

    // The print route is not part of the switch — it is how a PDF is made, and
    // it must keep working so the setting can be turned back on.
    const print = await fetch(`${base}/read/${ISSUE}/print?token=${token}`, {
      redirect: "manual",
    });
    ok(
      rendered(await print.text()),
      "downloads off: the internal print route still renders",
    );

    // And back on explicitly, not just via the default.
    await setDownloads(true);
    const backRes = await fetch(`${base}/api/issues/${ISSUE}/pdf`, {
      headers: cookie,
      redirect: "manual",
    });
    ok(
      backRes.status !== 403,
      `downloads back on: member is not refused (got ${backRes.status})`,
    );
  } finally {
    // Leave the database exactly as it was found — this one is shared with the
    // owner and with other work in progress. A row that was already there keeps
    // its other columns and gets the switch back to the value it held, which is
    // not always NULL: an owner who deliberately turned downloads off must not
    // find them back on because a test ran. A row this check created goes away
    // entirely, since "no row" was the state it found.
    if (rowPreexisted) {
      await sql`
        update settings set pdf_downloads_enabled = ${foundValue} where id = 1`;
    } else {
      await sql`delete from settings where id = 1`;
    }
    await sql`delete from sessions where session_token = ${sessionToken}`;
    await sql.end();
  }
}

// 8. The sponsor segment of the PDF cache key (issue #180). A sponsor block
//    stores only a sponsorId — the name, link and logo resolve at print time —
//    so editing or deleting a sponsor changes the printed page while leaving
//    `issues.content` and `issues.revision` untouched. The key therefore carries
//    a hash of the resolved sponsors, and the print route stamps the very same
//    value it rendered with (<meta name="print-sponsors">) for the generator to
//    check. Both sides call sponsorFingerprint(), so the stamp IS the key
//    segment: watching it here is watching the key, without a browser.
//
//    Scratch rows, cleaned up in the finally: one sponsor, one issue that places
//    it, and one issue that doesn't (which proves the hash covers the sponsors a
//    document actually references rather than the table at large — otherwise
//    every issue's PDF would be rebuilt each time any sponsor was touched).
{
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const sponsorId = randomUUID();
  const imageId = randomUUID();
  const withSponsor = { id: randomUUID(), number: 0 };
  const without = { id: randomUUID(), number: 0 };
  const NAME = "Gate Sponsor 180";
  const RENAMED = "Gate Sponsor 180 (renamed)";

  const page = (blocks: Record<string, string>[]) => ({
    id: String(randomUUID()),
    blocks,
  });
  const cover = { ...page([]), cover: true };
  const contentWith = {
    version: 5,
    pages: [
      cover,
      page([{ id: randomUUID(), type: "sponsor", sponsorId, name: "" }]),
    ],
  };
  const contentWithout = {
    version: 5,
    pages: [
      cover,
      page([{ id: randomUUID(), type: "heading", text: "No sponsors here" }]),
    ],
  };

  // React renders the attributes in source order, but read the tag rather than a
  // fixed string so a reordering (or a second meta) can't quietly pass.
  const stamp = (html: string, name: string) => {
    const tag = new RegExp(`<meta[^>]*name="${name}"[^>]*>`).exec(html)?.[0];
    return tag ? /content="([^"]*)"/.exec(tag)?.[1] : undefined;
  };
  const printed = async (number: number) => {
    const res = await fetch(`${base}/read/${number}/print?token=${token}`, {
      redirect: "manual",
    });
    const html = await res.text();
    ok(rendered(html), `scratch issue ${number}: print route renders`);
    return html;
  };

  try {
    await sql`
      insert into sponsors (id, name, href)
      values (${sponsorId}, ${NAME}, 'gate-sponsor.example/shop')`;
    // Numbered above everything published so far; both scratch issues are
    // removed again below, so the numbering stays as it was found.
    const [next] = await sql<{ n: number }[]>`
      select coalesce(max(number), 0) + 1 as n from issues`;
    withSponsor.number = Number(next!.n);
    without.number = withSponsor.number + 1;
    for (const [issue, content] of [
      [withSponsor, contentWith],
      [without, contentWithout],
    ] as const) {
      await sql`
        insert into issues (id, number, title, theme, status, content, published_at)
        values (${issue.id}, ${issue.number}, ${"PDF gate 180"}, 'classic',
                'published', ${sql.json(content)}, now())`;
    }

    const first = await printed(withSponsor.number);
    const before = stamp(first, "print-sponsors");
    ok(before, "sponsored issue: print document carries a sponsor stamp");
    ok(first.includes(NAME), "sponsored issue: the sponsor's name is printed");

    const plainStamp = stamp(await printed(without.number), "print-sponsors");
    ok(
      plainStamp === "nosponsors",
      `unsponsored issue: stamp says so (got ${plainStamp})`,
    );

    // Nothing changed: the same state must hash the same, or every download
    // would miss the cache and relaunch Chromium.
    ok(
      stamp(await printed(withSponsor.number), "print-sponsors") === before,
      "unchanged sponsor state: the stamp is stable (the cache key holds)",
    );

    // An edit to the sponsor row alone — no content write, so `revision` is
    // untouched and this segment is the only thing that can re-key.
    await sql`update sponsors set name = ${RENAMED} where id = ${sponsorId}`;
    const editedHtml = await printed(withSponsor.number);
    const edited = stamp(editedHtml, "print-sponsors");
    ok(edited !== before, `renamed sponsor: new stamp (${before} → ${edited})`);
    ok(
      editedHtml.includes(RENAMED) && !editedHtml.includes(`>${NAME}<`),
      "renamed sponsor: the print document carries the new name only",
    );

    // The link becomes a PDF annotation, so it is part of what a cached PDF
    // shows and has to be part of the hash.
    await sql`update sponsors set href = 'gate-sponsor.example/moved' where id = ${sponsorId}`;
    const relinked = stamp(await printed(withSponsor.number), "print-sponsors");
    ok(relinked !== edited, `relinked sponsor: new stamp (got ${relinked})`);

    // Giving the sponsor a logo changes the card, and re-uploading one mints a
    // fresh images row and a fresh storage key — which is why the hash takes the
    // resolved URL rather than the logo id. (This row points at no real object;
    // the print HTML only needs the <img src> the URL becomes.)
    await sql`
      insert into images (id, key) values (${imageId}, ${`pdf-gate-180/${imageId}.webp`})`;
    await sql`update sponsors set logo_id = ${imageId} where id = ${sponsorId}`;
    const withLogo = stamp(await printed(withSponsor.number), "print-sponsors");
    ok(
      withLogo !== relinked,
      `sponsor logo added: new stamp (got ${withLogo})`,
    );

    // And the case the issue was filed for: a removed sponsor must not keep
    // advertising in a cached PDF. The reference is left dangling by design, so
    // absence has to hash differently from presence.
    await sql`delete from sponsors where id = ${sponsorId}`;
    const goneHtml = await printed(withSponsor.number);
    const gone = stamp(goneHtml, "print-sponsors");
    ok(
      gone && ![before, edited, relinked, withLogo].includes(gone),
      `deleted sponsor: new stamp again (got ${gone})`,
    );
    ok(
      !goneHtml.includes(RENAMED),
      "deleted sponsor: the slot is gone from the print document",
    );
    ok(
      gone !== "nosponsors",
      "deleted sponsor: a dangling reference is not the same as never having one",
    );

    // The unsponsored issue sat through all of that untouched — its PDFs must
    // not be rebuilt for somebody else's sponsor.
    ok(
      stamp(await printed(without.number), "print-sponsors") === plainStamp,
      "unsponsored issue: unaffected by every sponsor change above",
    );
  } finally {
    // Scratch rows only, addressed by the ids this check minted — the database
    // is shared, so nothing here touches a row it did not create.
    await sql`delete from issues where id in (${withSponsor.id}, ${without.id})`;
    await sql`delete from sponsors where id = ${sponsorId}`;
    await sql`delete from images where id = ${imageId}`;
    await sql.end();
  }
}

console.log("\nall checks passed");
