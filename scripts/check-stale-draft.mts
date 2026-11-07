// The stale-reload draft store (#132) against an in-memory storage: kept and
// read back once, dropped when expired, malformed or for another issue, and
// harmless when the browser's storage throws.
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/check-stale-draft.mts
import {
  STALE_DRAFT_TTL,
  stashDraft,
  takeDraft,
  type StaleDraft,
} from "../src/features/discussion/stale-draft.ts";

let failures = 0;
const ok = (cond: unknown, msg: string) => {
  if (cond) console.log(`  ok — ${msg}`);
  else {
    failures++;
    console.log(`  FAIL — ${msg}`);
  }
};

function memory() {
  const map = new Map<string, string>();
  const store = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
  return { map, get: () => store };
}

const T = 1_800_000_000_000;
const drafts: StaleDraft[] = [
  { kind: "comment", body: "Lovely cover", pageId: "p1", newName: null },
  { kind: "comment", body: "First post", pageId: null, newName: "Ada" },
  { kind: "reply", parentId: "c1", body: "Agreed", newName: null },
  { kind: "edit", commentId: "c2", body: "Fixed typo" },
  { kind: "report", commentId: "c3", reason: "spam", note: "Twice now" },
  { kind: "report", commentId: "c3", reason: null, note: "" },
];

console.log("save and read once");
for (const d of drafts) {
  const m = memory();
  ok(stashDraft(14, d, m.get, T), `${d.kind} is kept`);
  ok(m.map.has("octavo:stale-draft:14"), `${d.kind} under the issue's key`);
  const back = takeDraft(14, m.get, T + 1000);
  ok(JSON.stringify(back) === JSON.stringify(d), `${d.kind} comes back whole`);
  ok(takeDraft(14, m.get, T + 2000) === null, `${d.kind} only once`);
  ok(m.map.size === 0, `${d.kind} leaves nothing behind`);
}

console.log("one slot per issue");
{
  const m = memory();
  stashDraft(14, drafts[0]!, m.get, T);
  stashDraft(14, drafts[3]!, m.get, T);
  stashDraft(15, drafts[2]!, m.get, T);
  ok(takeDraft(14, m.get, T)?.kind === "edit", "the newer draft replaces");
  ok(takeDraft(16, m.get, T) === null, "another issue finds nothing");
  ok(takeDraft(15, m.get, T)?.kind === "reply", "each issue its own");
}

console.log("expiry");
{
  const m = memory();
  stashDraft(14, drafts[0]!, m.get, T);
  ok(takeDraft(14, m.get, T + STALE_DRAFT_TTL) !== null, "30 minutes is kept");
  stashDraft(14, drafts[0]!, m.get, T);
  ok(takeDraft(14, m.get, T + STALE_DRAFT_TTL + 1) === null, "older dropped");
  ok(m.map.size === 0, "an expired draft is removed too");
  stashDraft(14, drafts[0]!, m.get, T);
  ok(takeDraft(14, m.get, T - 60_000) === null, "from the future dropped");
}

console.log("bad records");
for (const [what, raw] of [
  ["not JSON", "{oops"],
  ["no savedAt", JSON.stringify({ draft: drafts[0] })],
  ["unknown kind", JSON.stringify({ savedAt: T, draft: { kind: "poll" } })],
  [
    "body too long",
    JSON.stringify({
      savedAt: T,
      draft: { ...drafts[3], body: "x".repeat(2001) },
    }),
  ],
  [
    "unknown reason",
    JSON.stringify({ savedAt: T, draft: { ...drafts[4], reason: "rude" } }),
  ],
] as const) {
  const m = memory();
  m.map.set("octavo:stale-draft:14", raw);
  ok(takeDraft(14, m.get, T) === null, `${what} is dropped`);
  ok(m.map.size === 0, `${what} is removed`);
}

console.log("storage that throws");
{
  const boom = () => {
    throw new Error("SecurityError");
  };
  ok(!stashDraft(14, drafts[0]!, boom, T), "no storage: not kept");
  ok(takeDraft(14, boom, T) === null, "no storage: nothing to restore");
  const quota = {
    getItem: () => null,
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
    removeItem: () => {},
  };
  ok(!stashDraft(14, drafts[0]!, () => quota, T), "full storage: not kept");
}

console.log(failures ? `\n${failures} FAILED` : "\nall ok");
process.exit(failures ? 1 : 0);
