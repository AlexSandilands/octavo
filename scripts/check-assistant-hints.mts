// The assistant's hints and suggested follow-up (#366), in memory: the
// suggestion line's parsing and every refusal, and the hint deck — context,
// the pinned hint, relevant hints first, More ideas walking the whole list.
//   npx tsx --tsconfig scripts/tsconfig.json scripts/check-assistant-hints.mts
import assert from "node:assert/strict";
import { splitFollowUp } from "../src/lib/ai-follow-up";
import { claimFailures } from "./assistant-models/claims.mts";
import {
  dealHints,
  HINTS_SHOWN,
  moreThanShown,
  pinnedHint,
  type Deck,
  type HintContext,
} from "../src/features/editor/assistant/hints";
import {
  HINTS as PRESETS,
  presetMessage,
  type PresetId,
} from "../src/features/editor/assistant/presets";

let passed = 0;
const ok = (cond: unknown, msg: string) => {
  assert(cond, `FAIL: ${msg}`);
  passed++;
  console.log(`  ok — ${msg}`);
};

console.log("── the suggestion line");
const good = splitFollowUp(
  "Page 2 runs over by six lines.\nWant me to split it?\n[[next: Split page 2 | Yes, split page 2 onto a new page.]]",
);
ok(
  good.body === "Page 2 runs over by six lines.\nWant me to split it?" &&
    good.followUp?.label === "Split page 2" &&
    good.followUp.message === "Yes, split page 2 onto a new page.",
  "a valid line: label and message, dropped from the words shown",
);
ok(
  splitFollowUp("Done.  [[next: Go ahead | Yes, please.]]  ").followUp
    ?.label === "Go ahead",
  "on the reply's last line, or at its end",
);
ok(
  splitFollowUp("Nothing to offer.").followUp === null &&
    splitFollowUp("Nothing to offer.").body === "Nothing to offer.",
  "a reply without one is untouched",
);
for (const [what, line] of [
  ["a link", "[[next: Add it | Add https://example.com to page 1.]]"],
  ["a bare web address", "[[next: Add it | Add www.example.com to it.]]"],
  ["an email address", "[[next: Add it | Add bob@example.com to it.]]"],
  [
    "a block id",
    "[[next: Tidy it | Tidy [3f0c1a2b-1111-2222-3333-444455556666].]]",
  ],
  ["markup", "[[next: Tidy it | Tidy <b>this</b>.]]"],
  [
    "a label over 24 characters",
    "[[next: Go ahead and do all of that | Yes.]]",
  ],
  ["a message over 200 characters", `[[next: Go | ${"Yes. ".repeat(41)}]]`],
  ["no bar", "[[next: Go ahead]]"],
  ["an empty label", "[[next:  | Yes, go ahead.]]"],
  ["an empty message", "[[next: Go ahead | ]]"],
  ["no closing brackets", "[[next: Go ahead | Yes, go ahead."],
] as const) {
  const got = splitFollowUp(`Want me to?\n${line}`);
  ok(
    got.followUp === null && got.body === "Want me to?",
    `${what}: ignored, the line still dropped`,
  );
}
ok(
  splitFollowUp("Want me to?\n[[next: Go | Yes.]]\nOne more thing.")
    .followUp === null,
  "not the last line: no suggestion",
);
for (const partial of [
  "Want me to?\n[[",
  "Want me to?\n[[nex",
  "Want me to?\n[[next: Go ah",
])
  ok(
    splitFollowUp(partial).body === "Want me to?",
    `mid-stream "${partial.slice(12)}" doesn't flash up`,
  );
ok(
  claimFailures(
    "Want me to split it?\n[[next: Split page 2 | Yes, split page 2 onto a new page.]]",
    [{ name: "read_page", mutated: false }],
  ).length === 0,
  "the claim check reads the reply without the suggestion",
);

console.log("\n── the hints");
const ctx = (c: Partial<HintContext> = {}): HintContext => ({
  cover: false,
  overflow: false,
  photo: false,
  block: false,
  ...c,
});
const labels = new Set(PRESETS.map((p) => p.label));
ok(
  PRESETS.length >= 18 && labels.size === PRESETS.length,
  `${PRESETS.length} hints, each labelled once`,
);
ok(
  PRESETS.every((p) => p.label.split(" ").length <= 4 && p.label.length <= 24),
  "every label is four words or fewer",
);
const target = { page: 3, blockId: "3f0c1a2b-1111-2222-3333-444455556666" };
ok(
  PRESETS.every((p) => {
    const m = presetMessage(p.id, target);
    return m.length > 20 && !m.includes("undefined");
  }),
  "every hint has its message",
);
// A seeded random, so a failure repeats.
let seed = 7;
const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const walk = (c: HintContext, deals: number) => {
  let deck: Deck | null = null;
  const seen: PresetId[][] = [];
  for (let i = 0; i < deals; i++) {
    const next = dealHints(deck, c, i === 0, random);
    deck = next.deck;
    seen.push(next.drawn);
  }
  return seen;
};
const inside = walk(ctx(), 6);
ok(
  inside.every((d) => d.length === HINTS_SHOWN && new Set(d).size === d.length),
  "an inside page: four at a time, none twice",
);
const interior = PRESETS.filter((p) => !p.cover && !p.needs).map((p) => p.id);
const firstRound = new Set(
  inside.slice(0, Math.ceil(interior.length / 4)).flat(),
);
ok(
  interior.every((id) => firstRound.has(id)),
  `More ideas shows all ${interior.length} everyday hints within ${Math.ceil(interior.length / 4)} deals`,
);
ok(
  inside.flat().every((id) => interior.includes(id as never)),
  "no photo, overflow or block hints on a page without them",
);
ok(
  pinnedHint(ctx({ overflow: true })) === "shorten" &&
    walk(ctx({ overflow: true }), 5).every(
      (d) => d.length === HINTS_SHOWN - 1 && !d.includes("shorten"),
    ),
  "a page running over: Shorten to fit pinned, three drawn beside it",
);
ok(
  walk(ctx({ overflow: true }), 1)[0]![0] === "carry",
  "…and the other overflow hint leads the fresh deck",
);
const photo = walk(ctx({ photo: true }), 1)[0]!;
const photoHints = PRESETS.filter((p) => p.needs?.includes("photo")).map(
  (p) => p.id,
);
ok(
  photo.slice(0, 2).every((id) => photoHints.includes(id as never)) &&
    photo.slice(2).every((id) => !photoHints.includes(id as never)),
  `a photo on the page: two photo hints first (${photo.join(", ")})`,
);
ok(
  walk(ctx({ block: true }), 1)[0]![0] === "shorten-block",
  "a text block selected: Shorten this block first",
);
const cover = walk(ctx({ cover: true }), 3);
ok(
  pinnedHint(ctx({ cover: true })) === "compose" &&
    cover.every(
      (d) =>
        d.length === 3 &&
        d.every((id) => PRESETS.find((p) => p.id === id)!.cover),
    ) &&
    !moreThanShown(ctx({ cover: true })),
  "a cover: Compose cover pinned, the other three cover hints, no More ideas",
);
let deck = dealHints(null, ctx(), true, random).deck;
const changed = dealHints(deck, ctx({ overflow: true }), false, random);
ok(
  changed.drawn[0] === "carry" && changed.deck.at === 3,
  "a changed context starts a fresh deck",
);
deck = { key: deck.key, order: deck.order, at: deck.order.length - 2 };
const wrap = dealHints(deck, ctx(), false, random);
ok(
  wrap.drawn.slice(0, 2).join() === deck.order.slice(-2).join() &&
    new Set(wrap.drawn).size === 4,
  "the deck's last two lead the next, so none is skipped",
);

console.log(`\nassistant hints: all ${passed} checks passed`);
