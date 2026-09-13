import assert from "node:assert/strict";
import { getSchema } from "@tiptap/core";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import { CoverPaint } from "../src/features/editor/cover-paint-mark";
import { Underline } from "../src/features/editor/rich-text-marks";
import { changeCoverSelectionFamily } from "../src/features/editor/cover-font-selection";

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
assert(!changeCoverSelectionFamily(empty, "roboto-condensed", 400));
assert.equal(empty.steps.length, 0);
console.log(
  "PASS: mixed-run font changes retain weights/emphasis/paint, clamp per run, respect partial selection and reset safely",
);
