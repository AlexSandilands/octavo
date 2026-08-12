// Dev-only: exercises the PDF route's Content-Disposition builder (issue #138)
// against the magazine names an owner can now actually set — apostrophes,
// parens, asterisks, accents, all-CJK, empty — asserting the RFC 8187
// ext-value contains nothing but attr-chars and pct-escapes, and that the plain
// `filename=` fallback stays non-empty, ASCII and header-safe. No browser, DB or
// dev server.
//
// Unlike the other check scripts this can't import its subject: the builder
// lives in a Next.js route module, whose export surface is restricted to route
// handlers. Rather than keep a copy that would drift, it lifts the real source
// of `extValue` + `contentDisposition` out of the route file and compiles that.
// Run: npx tsx scripts/check-content-disposition.mts
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROUTE = join(process.cwd(), "src/app/api/issues/[number]/pdf/route.ts");

const source = readFileSync(ROUTE, "utf8");
const start = source.indexOf("function extValue(");
const end = source.indexOf("export async function GET(");
if (start < 0 || end < 0 || end < start) {
  throw new Error("Could not locate the helpers in the route source.");
}

// Re-emit the extracted source as its own module and let tsx compile it, so the
// TypeScript here is the route's own, not a hand-stripped approximation.
const dir = mkdtempSync(join(tmpdir(), "cd-check-"));
const modulePath = join(dir, "helpers.ts");
writeFileSync(
  modulePath,
  `${source.slice(start, end)}\nexport { contentDisposition };\n`,
);

const { contentDisposition } = (await import(modulePath)) as {
  contentDisposition: (magazineName: string, issueNumber: number) => string;
};
rmSync(dir, { recursive: true, force: true });

// RFC 8187 attr-char, the only characters allowed bare in an ext-value.
const ATTR_CHAR = /^[A-Za-z0-9!#$&+\-.^_`|~]$/;

const CASES: Array<[label: string, name: string, issue: number]> = [
  ["plain ASCII", "The Octavo", 4],
  ["apostrophe", "St John's Gazette", 12],
  ["parentheses", "The Gazette (Annual)", 7],
  ["asterisk + bang", "Star* Weekly!", 3],
  ["percent + quote", 'The 100% "Real" Times', 9],
  ["backslash", "Back\\slash Review", 2],
  ["accented", "Kaipātiki Boaters' Journal", 21],
  ["pure CJK", "日本語雑誌", 5],
  ["emoji only", "📰📰", 1],
  ["empty name", "", 8],
  ["whitespace only", "   ", 6],
  ["control chars", "News\r\nInjected: x", 11],
];

type Row = {
  label: string;
  extValue: string;
  plain: string;
  extOk: boolean;
  plainOk: boolean;
  roundTrip: boolean;
};

const rows: Row[] = [];
let failures = 0;

for (const [label, name, issue] of CASES) {
  const header = contentDisposition(name, issue);

  const ext = /filename\*=UTF-8''([^;]*)$/.exec(header)?.[1];
  const plain = /filename="([^"]*)"/.exec(header)?.[1];
  if (ext === undefined || plain === undefined) {
    console.error(`FAIL [${label}] header did not parse: ${header}`);
    failures++;
    continue;
  }

  // 1. The ext-value is attr-char / pct-escape only.
  let extOk = true;
  for (let i = 0; i < ext.length; i++) {
    const c = ext.charAt(i);
    if (c === "%") {
      if (!/^[0-9A-Fa-f]{2}$/.test(ext.slice(i + 1, i + 3))) extOk = false;
      i += 2;
      continue;
    }
    if (!ATTR_CHAR.test(c)) extOk = false;
  }
  // Belt-and-braces: the delimiter itself must never appear bare.
  if (ext.includes("'")) extOk = false;

  // 2. The plain fallback is non-empty, ASCII, and header/quoted-string safe.
  const plainOk =
    plain.trim().length > 0 &&
    plain.endsWith(".pdf") &&
    plain !== ".pdf" &&
    /^[\x20-\x7e]*$/.test(plain) &&
    !/["\\\r\n]/.test(plain) &&
    // The whole header must stay a single line.
    !/[\r\n]/.test(header);

  // 3. The client parser (use-issue-pdf.ts) decodes the ext-value back.
  let roundTrip = false;
  try {
    roundTrip = decodeURIComponent(ext) === `${name} No. ${issue}.pdf`;
  } catch {
    roundTrip = false;
  }

  if (!extOk || !plainOk || !roundTrip) failures++;
  rows.push({ label, extValue: ext, plain, extOk, plainOk, roundTrip });
}

const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - s.length));
const w = {
  label: Math.max(5, ...rows.map((r) => r.label.length)),
  ext: Math.max(9, ...rows.map((r) => r.extValue.length)),
  plain: Math.max(14, ...rows.map((r) => r.plain.length)),
};
console.log(
  `${pad("case", w.label)}  ${pad("filename*", w.ext)}  ${pad("filename= (plain)", w.plain)}  ext  plain  round-trip`,
);
console.log("-".repeat(w.label + w.ext + w.plain + 26));
for (const r of rows) {
  console.log(
    `${pad(r.label, w.label)}  ${pad(r.extValue, w.ext)}  ${pad(r.plain, w.plain)}  ` +
      `${r.extOk ? " ok" : "BAD"}  ${r.plainOk ? "  ok" : " BAD"}  ${r.roundTrip ? "ok" : "BAD"}`,
  );
}

console.log(
  failures === 0
    ? `\nAll ${rows.length} cases pass.`
    : `\n${failures} case(s) FAILED.`,
);
process.exit(failures === 0 ? 0 : 1);
