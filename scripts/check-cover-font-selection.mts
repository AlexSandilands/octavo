import assert from "node:assert/strict";
import { getSchema } from "@tiptap/core";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import { CoverPaint } from "../src/features/editor/cover-paint-mark";
import { Underline } from "../src/features/editor/rich-text-marks";
import {
  changeCoverSelectionFamily,
  changeCoverSelectionWeight,
  selectedCoverFont,
} from "../src/features/editor/cover-font-selection";

import {
  coverSelectionIsBold,
  toggleCoverSelectionBold,
} from "../src/features/editor/cover-bold";

const schema = getSchema([StarterKit, CoverPaint, Underline]);
const paint = schema.marks.coverPaint!;
const doc = schema.node("doc", null, [
  schema.node("paragraph", null, [
    schema.text("Start "),
    schema.text("regular", [paint.create({ color: "paper", shadow: "soft" })]),
    schema.text("bold", [schema.marks.bold!.create()]),
    schema.text("heavy", [
      paint.create({
        fontFamily: "hanken-grotesk",
        fontWeight: 900,
        fontStyle: "italic",
        color: "green",
      }),
      schema.marks.underline!.create(),
    ]),
    schema.text("light", [
      paint.create({
        fontFamily: "roboto-condensed",
        fontWeight: 100,
        shadow: "strong",
      }),
    ]),
    schema.text(" End"),
  ]),
]);
const start = 9; // The last five letters of regular, then bold/heavy/light.
const end = doc.content.size - 5;
const state = EditorState.create({
  doc,
  selection: TextSelection.create(doc, start, end),
});
const tr = state.tr;
assert(changeCoverSelectionFamily(tr, "newsreader", 500));

assert.equal(tr.doc.textContent, doc.textContent);
const runs: {
  text: string;
  attrs: Record<string, unknown>;
  marks: string[];
}[] = [];
tr.doc.descendants((node) => {
  if (node.isText)
    runs.push({
      text: node.text!,
      attrs: paint.isInSet(node.marks)?.attrs ?? {},
      marks: node.marks.map((m) => m.type.name),
    });
});
const regular = runs.find((r) => r.text === "gular")!;
assert.equal(regular.attrs.fontWeight, 500);
assert.equal(regular.attrs.color, "paper");
assert.equal(regular.attrs.shadow, "soft");
assert(!regular.marks.includes("bold"));
const bold = runs.find((r) => r.text === "bold")!;
assert.equal(bold.attrs.fontWeight, 500);
assert(bold.marks.includes("bold"));
const heavy = runs.find((r) => r.text === "heavy")!;
assert.equal(heavy.attrs.fontWeight, 800);
assert.equal(heavy.attrs.color, "green");
assert.equal(heavy.attrs.fontStyle, "italic");
assert(heavy.marks.includes("underline"));
const light = runs.find((r) => r.text === "light")!;
assert.equal(light.attrs.fontWeight, 200);
assert.equal(light.attrs.shadow, "strong");
assert.equal(runs[0]!.attrs.fontFamily, undefined);
assert.equal(runs[1]!.text, "re");
assert.equal(runs[1]!.attrs.fontFamily, null);
assert.equal(runs.at(-1)!.attrs.fontFamily, undefined);

const reset = state.apply(tr).tr;
assert(changeCoverSelectionFamily(reset, null, 500));
reset.doc.nodesBetween(start, end, (node) => {
  if (!node.isText) return;
  const attrs = paint.isInSet(node.marks)!.attrs;
  assert.equal(attrs.fontFamily, null);
  assert.equal(attrs.fontWeight, null);
});
const empty = EditorState.create({ doc }).tr;
assert(changeCoverSelectionFamily(empty, "roboto-condensed", 400));
assert(empty.doc.eq(doc));
assert.equal(
  paint.isInSet(empty.storedMarks!)!.attrs.fontFamily,
  "roboto-condensed",
);
assert.equal(paint.isInSet(empty.storedMarks!)!.attrs.fontWeight, 400);
assert.equal(empty.steps.length, 0);
console.log(
  "PASS: mixed-run font changes retain weights/emphasis/paint, clamp per run, respect partial selection and reset safely",
);

const font = { family: "newsreader", weight: 500 } as const;
assert(!coverSelectionIsBold(state, font));
const makeBold = state.tr;
assert(toggleCoverSelectionBold(makeBold, font));
assert(coverSelectionIsBold(makeBold, font));
makeBold.doc.nodesBetween(start, end, (node) => {
  if (!node.isText) return;
  const attrs = paint.isInSet(node.marks)!.attrs;
  assert.equal(attrs.fontWeight, node.text === "heavy" ? 900 : 700);
  if (node.text === "heavy") {
    assert.equal(attrs.fontStyle, "italic");
    assert.equal(attrs.color, "green");
    assert(schema.marks.underline!.isInSet(node.marks));
  }
});
assert.equal(makeBold.doc.firstChild!.firstChild!.text, "Start ");
assert.equal(makeBold.doc.firstChild!.firstChild!.marks.length, 0);
const makeRegular = state.apply(makeBold).tr;
assert(toggleCoverSelectionBold(makeRegular, font));
assert(!coverSelectionIsBold(makeRegular, font));
makeRegular.doc.nodesBetween(start, end, (node) => {
  if (!node.isText) return;
  assert.equal(paint.isInSet(node.marks)!.attrs.fontWeight, 400);
  assert(!schema.marks.bold!.isInSet(node.marks));
});
let heavyPosition = 0;
doc.descendants((node, pos) => {
  if (node.text === "heavy") heavyPosition = pos + 1;
});
const caret = EditorState.create({
  doc,
  selection: TextSelection.create(doc, heavyPosition),
});
assert(coverSelectionIsBold(caret, font));
const typing = caret.tr;
assert(toggleCoverSelectionBold(typing, font));
assert(typing.doc.eq(doc), "caret Bold does not rewrite existing text");
assert(!coverSelectionIsBold(typing, font));
assert.equal(paint.isInSet(typing.storedMarks!)!.attrs.fontWeight, 400);
assert.equal(paint.isInSet(typing.storedMarks!)!.attrs.color, "green");
assert(schema.marks.underline!.isInSet(typing.storedMarks!));
console.log(
  "PASS: mixed-weight Bold state, partial-range toggles, heavy-run preservation and caret-only typing marks",
);

const cursorFonts = caret.tr;
assert.equal(
  selectedCoverFont(cursorFonts, font).effectiveFamily,
  "hanken-grotesk",
);
assert.equal(selectedCoverFont(cursorFonts, font).effectiveWeight, 900);
assert(changeCoverSelectionFamily(cursorFonts, "newsreader", font.weight));
assert.equal(selectedCoverFont(cursorFonts, font).effectiveWeight, 800);
assert(changeCoverSelectionWeight(cursorFonts, 400, font));
assert.equal(
  selectedCoverFont(cursorFonts, font).effectiveFamily,
  "newsreader",
);
assert.equal(selectedCoverFont(cursorFonts, font).effectiveWeight, 400);
assert(cursorFonts.doc.eq(doc));
assert.equal(
  paint.isInSet(cursorFonts.storedMarks!)!.attrs.fontStyle,
  "italic",
);
assert(schema.marks.underline!.isInSet(cursorFonts.storedMarks!));
const inserted = cursorFonts.insertText(" NEW ");
const insertedRuns: { text: string; weight: unknown }[] = [];
inserted.doc.descendants((node) => {
  if (node.isText)
    insertedRuns.push({
      text: node.text!,
      weight: paint.isInSet(node.marks)?.attrs.fontWeight,
    });
});
assert(insertedRuns.some((r) => r.text === " NEW " && r.weight === 400));
assert(insertedRuns.some((r) => r.text === "eavy" && r.weight === 900));
const inherit = caret.tr;
assert(changeCoverSelectionWeight(inherit, null, font));
assert.equal(
  selectedCoverFont(inherit, font).effectiveFamily,
  "hanken-grotesk",
);
assert.equal(selectedCoverFont(inherit, font).effectiveWeight, 500);
assert(changeCoverSelectionFamily(inherit, null, font.weight));
assert.equal(selectedCoverFont(inherit, font).effectiveFamily, "newsreader");
assert.equal(selectedCoverFont(inherit, font).effectiveWeight, 500);
assert(inherit.doc.eq(doc));
const cleared = caret.tr.setStoredMarks([]);
assert.equal(
  selectedCoverFont(cleared, font).effectiveWeight,
  500,
  "explicitly cleared typing marks override cursor document marks",
);
console.log(
  "PASS: caret family/weight chaining, effective defaults, reset and insertion preserve existing text",
);
