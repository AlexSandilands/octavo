// Dev-only helper for verifying the magic-link flow (issue #3). Upserts a
// test member and prints auth-related table counts. Not part of the app.
// Also checks the unsubscribe tokens in-process (issue #303): both purposes
// round-trip, a token minted before purposes existed still means `issues`,
// and a token whose purpose is swapped, added or dropped fails.
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/dev-auth-check.mts [--cleanup]
import { createHmac, randomUUID } from "node:crypto";
import postgres from "postgres";

process.loadEnvFile?.(".env.local");
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

const TEST_EMAIL = "member@example.com";

if (process.argv.includes("--cleanup")) {
  await sql`delete from users where email = ${TEST_EMAIL}`;
  console.log("test member removed");
} else {
  await sql`
    insert into users (id, email, name) values (${crypto.randomUUID()}, ${TEST_EMAIL}, 'Test Member')
    on conflict (email) do nothing`;
  console.log("test member present:", TEST_EMAIL);
}

const [counts] = await sql`
  select
    (select count(*) from users) as users,
    (select count(*) from sessions) as sessions,
    (select count(*) from verification_tokens) as tokens`;
console.log(counts);
await sql.end();

// ── Unsubscribe token purposes (#303) ──────────────────────────────────────
const { signUnsubscribeToken, verifyUnsubscribeToken } =
  await import("../src/server/unsubscribe-token.ts");
let failed = 0;
const ok = (cond: unknown, msg: string) => {
  if (!cond) failed++;
  console.log(`${cond ? "ok" : "FAIL"} — ${msg}`);
};
const id = randomUUID();

// A token exactly as the code before #303 minted it: the bare user id.
const key = createHmac("sha256", process.env.AUTH_SECRET!)
  .update("octavo/unsubscribe/v1")
  .digest();
const legacy = `${Buffer.from(id).toString("base64url")}.${createHmac("sha256", key).update(id).digest("base64url")}`;
// The same signature over a different payload.
const relabel = (token: string, payload: (old: string) => string) => {
  const [body, mac] = token.split(".");
  const old = Buffer.from(body!, "base64url").toString("utf8");
  return `${Buffer.from(payload(old)).toString("base64url")}.${mac}`;
};
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

const issues = signUnsubscribeToken(id, "issues");
const replies = signUnsubscribeToken(id, "replies");
ok(
  same(verifyUnsubscribeToken(issues), { userId: id, purpose: "issues" }),
  "an issues token verifies as issues",
);
ok(
  same(verifyUnsubscribeToken(replies), { userId: id, purpose: "replies" }),
  "a replies token verifies as replies",
);
ok(
  same(verifyUnsubscribeToken(legacy), { userId: id, purpose: "issues" }),
  "a pre-#303 token (no purpose) still verifies, as issues",
);
ok(issues !== replies && issues !== legacy, "the three tokens differ");
for (const [label, token] of [
  [
    "replies relabelled issues",
    relabel(replies, (p) => p.replace("replies:", "issues:")),
  ],
  [
    "issues relabelled replies",
    relabel(issues, (p) => p.replace("issues:", "replies:")),
  ],
  [
    "replies with its purpose dropped",
    relabel(replies, (p) => p.replace("replies:", "")),
  ],
  ["a pre-#303 token given a purpose", relabel(legacy, (p) => `replies:${p}`)],
  ["another member's id", relabel(replies, () => `replies:${randomUUID()}`)],
  [
    "a flipped signature",
    `${replies.slice(0, -1)}${replies.endsWith("A") ? "B" : "A"}`,
  ],
  ["no signature", replies.split(".")[0]!],
] as const) {
  ok(verifyUnsubscribeToken(token) === null, `refused: ${label}`);
}
ok(verifyUnsubscribeToken(undefined) === null, "refused: no token at all");
console.log(
  failed ? `\n${failed} FAILED` : "\nunsubscribe tokens: all checks passed",
);
process.exit(failed ? 1 : 0);
