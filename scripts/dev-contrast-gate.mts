// Dev-only: verifies the WCAG AA contrast tokens (issue #10) statically — no
// browser or dev server needed. Parses the design tokens straight out of
// globals.css and asserts that every foreground used for readable text clears
// 4.5:1 against each paper-family background it renders on, and that the amber
// warn ink works both as text on warn-soft and as a background under paper ink.
// Run: npx tsx scripts/dev-contrast-gate.mts
import { readFile } from "node:fs/promises";

const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
};

const css = await readFile(
  new URL("../src/app/globals.css", import.meta.url),
  "utf8",
);

// Pull `--color-name: #hex;` declarations out of the @theme block.
const tokens = new Map<string, string>();
for (const m of css.matchAll(/--color-([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)) {
  tokens.set(m[1]!, m[2]!.toLowerCase());
}

const hex = (name: string) => {
  const v = tokens.get(name);
  if (!v) throw new Error(`token --color-${name} not found in globals.css`);
  return v;
};

// Relative luminance + contrast ratio, per WCAG 2.x.
const luminance = (h: string) => {
  const c = h.replace("#", "");
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const contrast = (a: string, b: string) => {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
};

const AA = 4.5;
// The paper-family surfaces readable text sits on across the app.
const backgrounds = ["paper", "page", "card", "stage", "tint", "warn-soft"];

// Foreground tokens that carry readable text (metadata, hints, page numbers,
// status labels) and must all clear AA on every background above.
for (const fg of ["muted", "faint", "faint2", "warn"]) {
  for (const bg of backgrounds) {
    const r = contrast(hex(fg), hex(bg));
    ok(
      r >= AA,
      `${fg} on ${bg} is ${r.toFixed(2)}:1 (≥ ${AA})`,
    );
  }
}

// The draft ribbon paints paper-coloured text on a solid warn background, so
// that pairing must clear AA the other way round too.
{
  const r = contrast(hex("paper"), hex("warn"));
  ok(r >= AA, `paper ink on warn background is ${r.toFixed(2)}:1 (≥ ${AA})`);
}

console.log("\nall checks passed");
