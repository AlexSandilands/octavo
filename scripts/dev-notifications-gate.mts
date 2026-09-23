// Dev-only: reply notifications (issue #303) end to end against a running dev
// server — replies posted through the reader, the bell's count and menu for
// the parent author only (a shared account told whose comment it was),
// choosing an entry (the thread opens on the reply, marked read), Mark all
// read, hidden and deleted replies dropping out, the newest-20 cap at desktop
// and 390px, the off switch; the reply email's conditions, wording and
// escaping, its magic link signing in a fresh browser (used and day-old links
// → the expired sign-in, the reply kept as ?next), both unsubscribe purposes
// and the tokens already in members' inboxes.
//
// Start the server with APP_URL and AUTH_URL naming it, its output in a log:
//   APP_URL=http://localhost:3303 AUTH_URL=http://localhost:3303 \
//     npm run dev -- -p 3303 > /tmp/dev.log 2>&1
// Against a demo-mode server (NEXT_PUBLIC_DEMO_MODE=1, detected: the library
// answers a signed-out visitor) it checks the null visitor has no bell.
//
// Every row it makes is prefixed check-303 and removed in the finally;
// `settings.comments_enabled` must be on (the baseline) and the settings row
// is restored exactly as found. Screenshots go to .data/notifications-review.
//
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/dev-notifications-gate.mts <base-url> <dev-log>
import { mkdir } from "node:fs/promises";
import { register } from "node:module";
import path from "node:path";
import postgres from "postgres";
import { chromium } from "playwright";
import { bellGate, demoGate, offGate } from "./notifications-gate-bell.mts";
import {
  emailGate,
  linkGate,
  PAT_TOP,
  type Cast,
} from "./notifications-gate-email.mts";
import { notificationsKit } from "./notifications-gate-kit.mts";
import { moduleGate, unsubscribeGate } from "./notifications-gate-unsub.mts";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {}
}
// The app modules the in-process checks load reach @sentry/nextjs, whose
// functions tsx can't see through its CJS build: the discussion checks' hook
// stands their recording stub in (and a session stub nothing here uses).
register("./fixtures/discussion/session-hooks.mjs", import.meta.url);
const [base, log] = process.argv.slice(2);
if (!base || !log) {
  throw new Error("usage: dev-notifications-gate.mts <base-url> <dev-log>");
}
const out = path.resolve(".data/notifications-review");
await mkdir(out, { recursive: true });
const sql = postgres(process.env.DATABASE_URL!, { max: 3 });

const [before] = await sql`select * from settings where id = 1`;
if (before?.comments_enabled !== true) {
  throw new Error("comments_enabled must be on for this gate (the baseline).");
}

const browser = await chromium.launch();
const k = notificationsKit({ sql, base, browser, out, log });
let left = -1;
try {
  const signedOut = await fetch(`${base}/`, { redirect: "manual" });
  if (signedOut.status === 200) {
    await demoGate(k);
  } else {
    const { getSettings } = await import("../src/server/settings.ts");
    const pat = await k.member("pat", {
      account: "Patricia Account",
      replyEmails: true,
    });
    const house = await k.member("house", { account: "House Account" });
    const rex = await k.member("rex", { account: "Rex Account" });
    const patName = await k.name(pat.id, "Pat Check");
    await k.name(house.id, "Hana Check");
    const hughName = await k.name(house.id, "Hugh Check");
    const rexName = await k.name(rex.id, "Rex Check");
    const issue = await k.issue();
    const cast: Cast = {
      issue,
      magazine: (await getSettings()).name,
      pat,
      patName,
      patTop: await k.comment(issue.id, pat, patName, PAT_TOP, {
        ago: "1 day",
      }),
      house,
      hughName,
      hughTop: await k.comment(
        issue.id,
        house,
        hughName,
        "check-303 Hugh here",
        {
          ago: "1 day",
        },
      ),
      rex,
      rexName,
    };

    const sent = await emailGate(k, cast);
    await bellGate(k, cast, sent.reply1);
    await linkGate(k, cast, sent);
    await unsubscribeGate(k, cast);
    await moduleGate(k, cast);
    await offGate(k, cast);
  }
} catch (err) {
  console.log(`\nFAIL — the gate stopped: ${(err as Error).stack}`);
  process.exitCode = 1;
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
const passed = failures === 0 && left === 0 && !process.exitCode;
console.log(passed ? "\nPASS — notifications gate" : `\n${failures} FAILED`);
process.exit(passed ? 0 : 1);
