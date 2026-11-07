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
// The page load that keeps a draft, and the reload that puts it back.
const KEEP = "load-a";
const RELOAD = "load-b";
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
  ok(
    stashDraft(14, d, { store: m.get, now: T, load: KEEP }),
    `${d.kind} is kept`,
  );
  ok(m.map.has("octavo:stale-draft:14"), `${d.kind} under the issue's key`);
  const back = takeDraft(14, { store: m.get, now: T + 1000, load: RELOAD });
  ok(JSON.stringify(back) === JSON.stringify(d), `${d.kind} comes back whole`);
  ok(
    takeDraft(14, { store: m.get, now: T + 2000, load: RELOAD }) === null,
    `${d.kind} only once`,
  );
  ok(m.map.size === 0, `${d.kind} leaves nothing behind`);
}

console.log("not before the reload");
{
  const m = memory();
  stashDraft(14, drafts[0]!, { store: m.get, now: T, load: KEEP });
  ok(
    takeDraft(14, { store: m.get, now: T, load: KEEP }) === null,
    "the same page load (thread reopened) restores nothing",
  );
  ok(m.map.size === 1, "and leaves the draft for the reload");
  ok(
    takeDraft(14, { store: m.get, now: T, load: RELOAD })?.kind === "comment",
    "the reload still gets it",
  );
}

console.log("one slot per issue");
{
  const m = memory();
  stashDraft(14, drafts[0]!, { store: m.get, now: T, load: KEEP });
  stashDraft(14, drafts[3]!, { store: m.get, now: T, load: KEEP });
  stashDraft(15, drafts[2]!, { store: m.get, now: T, load: KEEP });
  ok(
    takeDraft(14, { store: m.get, now: T, load: RELOAD })?.kind === "edit",
    "the newer draft replaces",
  );
  ok(
    takeDraft(16, { store: m.get, now: T, load: RELOAD }) === null,
    "another issue finds nothing",
  );
  ok(
    takeDraft(15, { store: m.get, now: T, load: RELOAD })?.kind === "reply",
    "each issue its own",
  );
}

console.log("expiry");
{
  const m = memory();
  stashDraft(14, drafts[0]!, { store: m.get, now: T, load: KEEP });
  ok(
    takeDraft(14, { store: m.get, now: T + STALE_DRAFT_TTL, load: RELOAD }) !==
      null,
    "30 minutes is kept",
  );
  stashDraft(14, drafts[0]!, { store: m.get, now: T, load: KEEP });
  ok(
    takeDraft(14, {
      store: m.get,
      now: T + STALE_DRAFT_TTL + 1,
      load: RELOAD,
    }) === null,
    "older dropped",
  );
  ok(m.map.size === 0, "an expired draft is removed too");
  stashDraft(14, drafts[0]!, { store: m.get, now: T, load: KEEP });
  ok(
    takeDraft(14, { store: m.get, now: T - 60_000, load: RELOAD }) === null,
    "from the future dropped",
  );
}

console.log("bad records");
for (const [what, raw] of [
  ["not JSON", "{oops"],
  ["no savedAt", JSON.stringify({ load: "x", draft: drafts[0] })],
  ["no load", JSON.stringify({ savedAt: T, draft: drafts[0] })],
  [
    "unknown kind",
    JSON.stringify({ savedAt: T, load: "x", draft: { kind: "poll" } }),
  ],
  [
    "body too long",
    JSON.stringify({
      savedAt: T,
      load: "x",
      draft: { ...drafts[3], body: "x".repeat(2001) },
    }),
  ],
  [
    "unknown reason",
    JSON.stringify({
      savedAt: T,
      load: "x",
      draft: { ...drafts[4], reason: "rude" },
    }),
  ],
] as const) {
  const m = memory();
  m.map.set("octavo:stale-draft:14", raw);
  ok(
    takeDraft(14, { store: m.get, now: T, load: RELOAD }) === null,
    `${what} is dropped`,
  );
  ok(m.map.size === 0, `${what} is removed`);
}

console.log("storage that throws");
{
  const boom = () => {
    throw new Error("SecurityError");
  };
  ok(
    !stashDraft(14, drafts[0]!, { store: boom, now: T, load: KEEP }),
    "no storage: not kept",
  );
  ok(
    takeDraft(14, { store: boom, now: T, load: RELOAD }) === null,
    "no storage: nothing to restore",
  );
  const quota = {
    getItem: () => null,
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
    removeItem: () => {},
  };
  ok(
    !stashDraft(14, drafts[0]!, { store: () => quota, now: T, load: KEEP }),
    "full storage: not kept",
  );
}

console.log(failures ? `\n${failures} FAILED` : "\nall ok");
process.exit(failures ? 1 : 0);
