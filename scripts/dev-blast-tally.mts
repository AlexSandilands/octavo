// Dev-only unit check for the blast's partial-failure accounting (issue #9).
// The real Resend path can't be exercised locally (no verified sending domain,
// and dev uses the console transport), so this drives the pure tally loop with
// a stub transport that fails one chunk mid-batch — proving a failure is
// counted and reported, not thrown, and never aborts the run.
// Run: npx tsx scripts/dev-blast-tally.mts
import { tallyChunks, BATCH_SIZE, type PreparedEmail } from "../src/lib/blast.ts";

const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
};

const fakeEmails = (n: number): PreparedEmail[] =>
  Array.from({ length: n }, (_, i) => ({
    to: `m${i}@example.com`,
    subject: "s",
    html: "h",
    text: "t",
  }));

// 250 recipients → 3 chunks (100, 100, 50). Fail the 2nd chunk only.
let call = 0;
const res = await tallyChunks(fakeEmails(250), async () => {
  call += 1;
  return call !== 2; // second chunk "fails" at the transport
});

ok(res.sent === 150, `sent counts the surviving chunks (got ${res.sent})`);
ok(res.failed === 100, `failed counts the dead chunk (got ${res.failed})`);
ok(res.sent + res.failed === 250, "every recipient is accounted for");
ok(BATCH_SIZE === 100, "batch size respects Resend's 100/call limit");

// A throw inside the loop would abort; confirm the loop itself never rejects
// when the transport reports failure (the transport owns its try/catch).
const allFail = await tallyChunks(fakeEmails(10), async () => false);
ok(allFail.sent === 0 && allFail.failed === 10, "total outage => all failed, no throw");

console.log("\nall checks passed");
