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

const read = (rel: string) => readFile(new URL(rel, import.meta.url), "utf8");

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
    .map((v) =>
      v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4),
    );
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
  ok(
    r >= AA,
    `[${id}] paper ink on warn background is ${r.toFixed(2)}:1 (≥ ${AA})`,
  );
};

for (const [id, tokens] of brands) {
  console.log(`\n— brand: ${id} —`);
  checkBrand(id, tokens);
}

// The house scrollbar (issue #207, swept across the app in #210): `.scrollbar-soft`
// in globals.css draws its thumb as `color-mix(in oklab, <surface>, ink 50%)`,
// where the surface is paper unless the region sets `--scrollbar-surface` (a
// card-backed panel: card). A scrollbar thumb is a UI affordance, so it needs
// 3:1 (WCAG 1.4.11) against the surface it sits on, on every brand. This
// mirrors the browser's oklab mix so the number is checked, not eyeballed.
const UI = 3;
const SCROLLBAR_SURFACES = ["paper", "card"];
const INK_MIX = 0.5;

const srgbToLinear = (v: number) =>
  v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
const linearToSrgb = (v: number) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
const hexToLinear = (h: string) =>
  [0, 2, 4].map((i) => srgbToLinear(parseInt(h.slice(1 + i, 3 + i), 16) / 255));
const toOklab = ([r, g, b]: number[]) => {
  const l = Math.cbrt(
    0.4122214708 * r! + 0.5363325363 * g! + 0.0514459929 * b!,
  );
  const m = Math.cbrt(
    0.2119034982 * r! + 0.6806995451 * g! + 0.1073969566 * b!,
  );
  const s = Math.cbrt(
    0.0883024619 * r! + 0.2817188376 * g! + 0.6299787005 * b!,
  );
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};
const fromOklab = ([L, a, b]: number[]) => {
  const l = (L! + 0.3963377774 * a! + 0.2158037573 * b!) ** 3;
  const m = (L! - 0.1055613458 * a! - 0.0638541728 * b!) ** 3;
  const s = (L! - 0.0894841775 * a! - 1.291485548 * b!) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
};
// `color-mix(in oklab, a, b <pct>)`: average the two in oklab, back to sRGB hex.
const mixOklab = (a: string, b: string, pctB: number) => {
  const la = toOklab(hexToLinear(a));
  const lb = toOklab(hexToLinear(b));
  const mixed = la.map((v, i) => v * (1 - pctB) + lb[i]! * pctB);
  return (
    "#" +
    fromOklab(mixed)
      .map((v) => Math.round(Math.min(1, Math.max(0, linearToSrgb(v))) * 255))
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
  );
};

for (const [id, tokens] of brands) {
  console.log(`\n— scrollbar thumb, brand: ${id} —`);
  const ink = tokens.get("ink")!;
  for (const surface of SCROLLBAR_SURFACES) {
    const thumb = mixOklab(tokens.get(surface)!, ink, INK_MIX);
    const r = contrast(thumb, tokens.get(surface)!);
    ok(
      r >= UI,
      `[${id}] scrollbar thumb ${thumb} on ${surface} is ${r.toFixed(2)}:1 (≥ ${UI})`,
    );
  }
}

console.log(`\nall checks passed (${brands.size} brand(s))`);
