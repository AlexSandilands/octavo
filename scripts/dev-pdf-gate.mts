// Dev-only: verifies the PDF export surface (issue #16) that is checkable
// without a browser binary — HTTP-level only, no Chromium. Covers:
//   - the internal print route's token gate (no/invalid token → 404),
//   - the print route rendering the issue HTML (the exact input Chromium prints)
//     when given the valid token, and 404 for an unpublished/unknown issue,
//   - the download endpoint's members-only gate (signed out → 403 JSON),
//   - the owner's site-wide download switch (issue #162): with it off, a
//     *signed-in member* is refused too, and the internal print route still
//     renders (turning downloads off is a distribution choice, not a rendering
//     one — the owner's next issue must still print).
// It derives the internal print token the same way the app does, from
// AUTH_SECRET in .env.local. Requires a running dev server and the seed's
// published issue number 3.
//
// The switch check writes to the shared dev database (settings.pdf_downloads_
// enabled) and mints a throwaway session; both are restored in a finally, so a
// failed run leaves the row back at NULL rather than a site with its downloads
// switched off.
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
  try {
    const [member] = await sql<{ id: string }[]>`
      select id from users order by created_at limit 1`;
    ok(member, "a member exists to sign in as");
    await sql`
      insert into sessions (session_token, user_id, expires)
      values (${sessionToken}, ${member!.id}, now() + interval '1 hour')`;
    const cookie = { Cookie: `authjs.session-token=${sessionToken}` };

    // Baseline: with the column NULL (the shipped default) the member is served.
    // Not a 200 — that would generate a PDF, which needs Chromium — but it must
    // get past the two 403s, so anything other than 403 is the pass.
    await sql`update settings set pdf_downloads_enabled = null where id = 1`;
    const onRes = await fetch(`${base}/api/issues/${ISSUE}/pdf`, {
      headers: cookie,
      redirect: "manual",
    });
    ok(
      onRes.status !== 403,
      `downloads on (NULL = default): member is not refused (got ${onRes.status})`,
    );

    await sql`update settings set pdf_downloads_enabled = false where id = 1`;
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
    await sql`update settings set pdf_downloads_enabled = true where id = 1`;
    const backRes = await fetch(`${base}/api/issues/${ISSUE}/pdf`, {
      headers: cookie,
      redirect: "manual",
    });
    ok(
      backRes.status !== 403,
      `downloads back on: member is not refused (got ${backRes.status})`,
    );
  } finally {
    // Leave the shared dev database as it was found: unconfigured, and no
    // stray session.
    await sql`update settings set pdf_downloads_enabled = null where id = 1`;
    await sql`delete from sessions where session_token = ${sessionToken}`;
    await sql.end();
  }
}

console.log("\nall checks passed");
