// Dev-only: the members' discussion thread (issue #301) end to end against a
// running server — the desktop drawer and the phone sheet at 390×844 and
// 360×740, posting as each of two names, the first post that brings its own
// name, a refused name, reply / edit / delete / report, the admin's read and
// the badge, the rate limit, deep links (a deleted comment's too), the off
// switch with and without a settings row, drafts, the print route, the counts
// on the library cards and in the delete confirmations (bulk included), and
// the lazy fetch.
//
// Against a demo-mode server (NEXT_PUBLIC_DEMO_MODE=1, detected: the reader
// answers a signed-out visitor) it runs the signed-out visitor's checks
// instead — the control without a count, the sign-in panel, nothing fetched,
// the list route's 401 and no counts on the library.
//
// Every row it makes is prefixed check-301 and removed in the finally;
// `settings.comments_enabled` must be on (the baseline) and the settings row
// is restored exactly as found. Screenshots go to .data/discussion-review.
//
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/dev-discussion-gate.mts <base-url>
import { mkdir } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { chromium } from "playwright";
import { addressGate } from "./discussion-gate-address.mts";
import { countsGate } from "./discussion-gate-counts.mts";
import { desktopGate, type Cast } from "./discussion-gate-desktop.mts";
import { discussionKit } from "./discussion-gate-kit.mts";
import { mobileGate } from "./discussion-gate-mobile.mts";
import { composerStates } from "./discussion-gate-composer.mts";
import { deepLinks, demoGate, offSwitch } from "./discussion-gate-states.mts";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {}
}
const base = process.argv[2];
if (!base) throw new Error("usage: dev-discussion-gate.mts <base-url>");
const out = path.resolve(".data/discussion-review");
await mkdir(out, { recursive: true });
const sql = postgres(process.env.DATABASE_URL!, { max: 3 });

const [before] = await sql`select * from settings where id = 1`;
if (before?.comments_enabled !== true) {
  throw new Error("comments_enabled must be on for this gate (the baseline).");
}

const browser = await chromium.launch();
const k = discussionKit({ sql, base, browser, out });
let left = -1;
try {
  // The cast: two readers, an admin with a badged name, and the issues.
  const alice = await k.member("alice", { name: "Alice Check" });
  const aliceNames: [string, string] = [
    await k.name(alice.id, "Alice Reader"),
    await k.name(alice.id, "A. Reader", { avatar: true }),
  ];
  const carol = await k.member("carol", { name: "Carol Check" });
  const carolName = await k.name(carol.id, "Carol Check");
  const ada = await k.member("ada", { admin: true, name: "Ada Check" });
  const adaName = await k.name(ada.id, "Ada Editor", { badge: true });
  const p = await k.issue(true, 0);
  const adaComment = await k.comment(p.id, ada, adaName, "check-301 from Ada", {
    ago: "3 days",
  });
  const cast: Cast = {
    issue: p,
    alice,
    aliceNames,
    carol,
    ada,
    adaName,
    adaComment,
  };

  const signedOut = await fetch(`${base}/read/${p.number}`, {
    redirect: "manual",
  });
  if (signedOut.status === 200) {
    await demoGate(k, cast);
  } else {
    k.heading("the list route");
    const anon = await fetch(`${base}/api/issues/${p.number}/comments`);
    k.ok(anon.status === 401, `signed out → 401 (${anon.status})`);
    const res = await fetch(`${base}/api/issues/${p.number}/comments`, {
      headers: { cookie: `authjs.session-token=${carol.token}` },
    });
    const payload = await res.json();
    k.ok(
      res.status === 200 &&
        res.headers.get("cache-control")?.includes("no-store"),
      "a member gets it, uncached",
    );
    k.ok(
      !JSON.stringify(payload).includes("@example.invalid") &&
        !JSON.stringify(payload).includes(ada.id),
      "with no email and no account id in it",
    );
    const missing = await fetch(`${base}/api/issues/999999/comments`, {
      headers: { cookie: `authjs.session-token=${carol.token}` },
    });
    k.ok(missing.status === 404, `an unknown issue → 404 (${missing.status})`);

    await desktopGate(k, cast);
    await mobileGate(k, cast);
    await composerStates(k, cast);

    const target = await k.comment(
      p.id,
      carol,
      carolName,
      "check-301 linked to",
      {
        ago: "30 minutes",
      },
    );
    const gone = await k.comment(p.id, carol, carolName, "check-301 soon gone");
    await sql`delete from comments where id = ${gone}`;
    const linkedReply = await k.comment(
      p.id,
      alice,
      aliceNames[0],
      "check-301 a linked reply",
      { parentId: target, ago: "10 minutes" },
    );
    await deepLinks(k, cast, target, gone, linkedReply);
    await addressGate(k, cast, target);

    const draft = await k.issue(false);
    await offSwitch(k, cast, draft);

    const q = await k.issue(true, 1);
    const r = await k.issue(true, 2);
    const empty = await k.issue(true, -1);
    const qTop = await k.comment(q.id, carol, carolName, "check-301 on Q");
    await k.comment(q.id, ada, adaName, "check-301 reply on Q", {
      parentId: qTop,
    });
    const hidden = await k.comment(
      q.id,
      carol,
      carolName,
      "check-301 hidden on Q",
    );
    await sql`update comments set hidden_at = now() where id = ${hidden}`;
    await k.comment(r.id, alice, aliceNames[0], "check-301 on R");
    await countsGate(k, { reader: carol, admin: ada, p, q, r, empty });
  }
} finally {
  await browser.close();
  left = await k.cleanup();
  const [after] = await sql`select * from settings where id = 1`;
  const same = JSON.stringify(after) === JSON.stringify(before);
  console.log(
    `\nscratch rows left: ${left}; settings row as found: ${same ? "yes" : "NO"}`,
  );
  if (!same) process.exitCode = 1;
  await sql.end();
}
const failures = k.failures();
console.log(
  failures === 0 && left === 0
    ? "\nPASS — discussion gate"
    : `\n${failures} FAILED`,
);
process.exit(failures === 0 && left === 0 && !process.exitCode ? 0 : 1);
