// Dev-only: verifies the WCAG AA contrast tokens (issue #10) statically for
// EVERY brand skin (issue #40) — no browser or dev server needed. Parses the
// heritage design tokens out of globals.css's @theme block and each non-default
// brand's `[data-brand="…"]` override block out of brands.css, merges them, and
// asserts that for every brand each foreground used for readable text clears
// 4.5:1 against each paper-family background it renders on, and that the amber
// warn ink works both as text on warn-soft and as a background under paper ink.
// Run: npx tsx scripts/dev-contrast-gate.mts
import { readFile } from "node:fs/promises";
import { BRAND_IDS, DEFAULT_BRAND } from "../src/lib/brands.ts";

const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
};

const read = (rel: string) =>
  readFile(new URL(rel, import.meta.url), "utf8");

const globalsCss = await read("../src/app/globals.css");
const brandsCss = await read("../src/app/brands.css");

// Pull `--color-name: #hex;` declarations out of a CSS chunk.
const parseTokens = (css: string) => {
  const tokens = new Map<string, string>();
  for (const m of css.matchAll(/--color-([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)) {
    tokens.set(m[1]!, m[2]!.toLowerCase());
  }
  return tokens;
};

// Heritage is the @theme default in globals.css; every other brand is a
// `[data-brand="id"] { … }` override block in brands.css, merged over heritage.
const heritage = parseTokens(globalsCss);

const brandOverrides = new Map<string, Map<string, string>>();
for (const m of brandsCss.matchAll(
  /\[data-brand="([\w-]+)"\]\s*\{([^}]*)\}/g,
)) {
  brandOverrides.set(m[1]!, parseTokens(m[2]!));
}

// Assemble the full token set each declared brand renders with.
const brands = new Map<string, Map<string, string>>();
for (const id of BRAND_IDS) {
  if (id === DEFAULT_BRAND) {
    brands.set(id, heritage);
    continue;
  }
  const override = brandOverrides.get(id);
  if (!override) {
    throw new Error(
      `brand "${id}" is declared in src/lib/brands.ts but has no ` +
        `[data-brand="${id}"] block in src/app/brands.css`,
    );
  }
  brands.set(id, new Map([...heritage, ...override]));
}

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

// Check one brand's full token set (the same bar #10 audited for heritage).
const checkBrand = (id: string, tokens: Map<string, string>) => {
  const hex = (name: string) => {
    const v = tokens.get(name);
    if (!v) throw new Error(`[${id}] token --color-${name} not found`);
    return v;
  };

  // Foreground tokens that carry readable text (metadata, hints, page numbers,
  // status labels) and must all clear AA on every background above.
  for (const fg of ["muted", "faint", "faint2", "warn"]) {
    for (const bg of backgrounds) {
      const r = contrast(hex(fg), hex(bg));
      ok(r >= AA, `[${id}] ${fg} on ${bg} is ${r.toFixed(2)}:1 (≥ ${AA})`);
    }
  }

  // The draft ribbon paints paper-coloured text on a solid warn background, so
  // that pairing must clear AA the other way round too.
  const r = contrast(hex("paper"), hex("warn"));
  ok(r >= AA, `[${id}] paper ink on warn background is ${r.toFixed(2)}:1 (≥ ${AA})`);
};

for (const [id, tokens] of brands) {
  console.log(`\n— brand: ${id} —`);
  checkBrand(id, tokens);
}

console.log(`\nall checks passed (${brands.size} brand(s))`);
