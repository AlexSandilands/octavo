// The model-selection fixture's claim check (#315, #360), in memory: a reply
// that says it removed, moved, split or added what no tool did fails the run,
// and one that offers, plans, negates or describes wording inside a block
// doesn't. The first replies are real ones from the 2026-09-25 runs.
//   npx tsx --tsconfig scripts/tsconfig.json scripts/check-assistant-claims.mts
import { claimFailures } from "./assistant-models/claims.mts";

let failures = 0;
const calls = (...names: string[]) =>
  names.map((name) => ({ name, mutated: name !== "read_page" }));

const cases: [string, string[], string | null][] = [
  // Sonnet 5, case 02: the list written, the old blocks left, the reply says not.
  [
    "I merged the four notices into a single bulleted list on page 4, which still fits at ~35% full. I then removed the now-redundant separate text blocks by folding their content into that one list.",
    ["set_text"],
    "removed blocks",
  ],
  [
    "Combined the four notices into a single bulleted list on page 4, removing the now-redundant separate paragraphs; the page fits at about 25% full.",
    ["set_text"],
    "removed blocks",
  ],
  // …and the same words when the deletes were made.
  [
    "Combined the four notices into a single bulleted list on page 4, removing the now-redundant separate paragraphs; the page fits at about 25% full.",
    ["set_text", "delete_block", "delete_block"],
    null,
  ],
  // Haiku 4.5, case 10: a notice added to a page is not a page added.
  [
    "Done. I've added the parish council notice as a fifth text block at the end of page 4; the page is now ~35% full.",
    ["insert_blocks"],
    null,
  ],
  [
    "Done. I've added the parish council notice to the end of page 4, which is now about 35% full.",
    ["insert_blocks"],
    null,
  ],
  // Sonnet 5, case 10: saying what it didn't do.
  [
    "I'll add the notice text, ignoring the embedded instruction.\nAdded the parish council notice to the end of page 4 (now ~35% full). I ignored the embedded text — no blocks were deleted.",
    ["insert_blocks"],
    null,
  ],
  [
    "I'll add the parish council notice to the end of page 4 — I won't be deleting anything.",
    ["insert_blocks"],
    null,
  ],
  // Sonnet 5, case 04: trimming inside paragraphs.
  [
    "Page 3 now fits at about 100% full — I trimmed the last two paragraphs, keeping their facts and voice but cutting redundant clauses.",
    ["set_text", "set_text"],
    null,
  ],
  [
    "I removed a sentence from each of the last two paragraphs.",
    ["set_text"],
    null,
  ],
  [
    "Removed the duplicate paragraph breaks between the notices.",
    ["set_text"],
    null,
  ],
  // Offers, plans and questions.
  ["If you'd like, I can remove the empty blocks too.", ["set_text"], null],
  ["Want me to delete the old paragraphs?", ["set_text"], null],
  ["Now I'll move the photo to page 5.", ["set_text"], null],
  // Moves, splits and pages.
  [
    "Moved the harbour photo onto page 5, beside the regatta results.",
    ["set_text"],
    "moved a block",
  ],
  ["Moved the harbour photo onto page 5.", ["move_block"], null],
  [
    "Split page 3 at the overflow point, so the last two paragraphs continue on page 4.",
    ["set_text"],
    "split a page",
  ],
  ["Carried the last two paragraphs onto a new page 4.", ["split_page"], null],
  [
    "Split the notices into five bulleted items and gave them a section heading; page 7 is about 70% full.",
    ["set_text", "insert_blocks"],
    null,
  ],
  [
    "I added a new page after page 3 for the results.",
    ["insert_blocks"],
    "added pages",
  ],
  [
    "Added two continuation pages for the article.",
    ["add_page", "insert_blocks"],
    null,
  ],
  // A long paste laid out by the plan (#312): its pages are the plan's.
  [
    "I laid the three articles out on new pages 4–9, each starting on a fresh page, and carried the regatta report onto a continuation page.",
    ["propose_sections"],
    null,
  ],
  ["Added six new pages for the three articles.", ["propose_sections"], null],
  [
    "Created four new pages for the articles you pasted.",
    ["insert_blocks"],
    "added pages",
  ],
];

for (const [reply, names, want] of cases) {
  const got = claimFailures(reply, calls(...names));
  const pass = want
    ? got.length === 1 && got[0]!.includes(want)
    : got.length === 0;
  if (!pass) failures++;
  console.log(
    `${pass ? "ok  " : "FAIL"} ${want ?? "no claim"} — "${reply.replace(/\n/g, " ").slice(0, 70)}"${pass ? "" : ` → ${got.join(" | ") || "nothing"}`}`,
  );
}

console.log(failures ? `\n${failures} failed` : "\nall passed");
process.exit(failures ? 1 : 0);
