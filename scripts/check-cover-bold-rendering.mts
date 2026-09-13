import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "playwright";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { CoverPaint } from "../src/features/editor/cover-paint-mark";
import { CoverRichText } from "../src/features/blocks/cover-rich-text";
import { coverRichDocSchema } from "../src/lib/cover-rich-text";

const schema = getSchema([StarterKit, CoverPaint]);
const css = await readFile("src/app/cover-elements.css", "utf8");
const bytes = await readFile("src/app/fonts/hanken-grotesk.woff2");
const italicBytes = await readFile("src/app/fonts/hanken-grotesk-italic.woff2");
const cases: { id: string; html: string; expected: number }[] = [];
for (const weight of [400, 500, 800, 900]) {
  for (const bold of [false, true]) {
    for (const reverse of [false, true]) {
      const paint = {
        type: "coverPaint",
        attrs: {
          fontFamily: "hanken-grotesk",
          fontWeight: weight,
          color: "green",
          fontStyle: "italic",
          shadow: "soft",
          shadowColor: "ink",
        },
      };
      const marks = bold ? [{ type: "bold" }, paint] : [paint];
      if (reverse) marks.reverse();
      const doc = coverRichDocSchema.parse({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "Māori", marks }],
          },
        ],
      });
      const expected = bold ? Math.max(700, weight) : weight;
      const id = `${weight}-${bold}-${reverse}`;
      cases.push({
        id: `reader-${id}`,
        expected,
        html: renderToStaticMarkup(
          createElement(CoverRichText, { text: "Māori", doc }),
        ),
      });
      // Use the production mark serializer's exact style and both possible nestings.
      const mark = schema.marks.coverPaint!.create(paint.attrs);
      const spec = schema.marks.coverPaint!.spec.toDOM!(mark, false) as [
        string,
        { style: string },
        number,
      ];
      const span = `<span style="${spec[1].style}">Māori</span>`;
      const html = !bold
        ? span
        : reverse
          ? span.replace("Māori", "<strong>Māori</strong>")
          : `<strong>${span}</strong>`;
      cases.push({
        id: `editor-${id}`,
        expected,
        html: `<div class="cover-text-editor">${html}</div>`,
      });
    }
  }
}
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent(`<style>
    @font-face { font-family: TestHanken; src: url(data:font/woff2;base64,${bytes.toString("base64")}); font-weight:100 900; }
    @font-face { font-family: TestHanken; src: url(data:font/woff2;base64,${italicBytes.toString("base64")}); font-weight:100 900; font-style:italic; }
    :root { --font-cover-hanken: TestHanken; }
    ${css}
  </style>${cases.map((c) => `<div id="${c.id}">${c.html}</div>`).join("")}`);
  await page.evaluate(() => document.fonts.ready);
  for (const c of cases) {
    const actual = await page.locator(`#${c.id}`).evaluate((root) => {
      const text = document
        .createTreeWalker(root, NodeFilter.SHOW_TEXT)
        .nextNode();
      const s = getComputedStyle(text!.parentElement!);
      return {
        weight: Number(s.fontWeight),
        family: s.fontFamily,
        style: s.fontStyle,
      };
    });
    assert.equal(actual.weight, c.expected, c.id);
    assert.equal(actual.family, "TestHanken", c.id);
    assert.equal(actual.style, "italic", c.id);
  }
  assert(
    await page.evaluate(() =>
      document.fonts.check("italic 900 16px TestHanken"),
    ),
  );
  console.log(
    `PASS: ${cases.length} reader/editor computed font cases; regular400/500 + Bold700, heavy800/900, both mark orders, italic preserved`,
  );
} finally {
  await browser.close();
}
