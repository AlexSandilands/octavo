// Scores one case's run: the pass/fail rule agreed for the spike is
// schema-valid final content AND the preserve check AND no overflow (estimated)
// AND no edits / no forbidden tools where required AND calls ≤ maxCalls.
// `expect.tools` is advisory only — reported, never failed on.
import {
  issueContentSchema,
  type IssueContent,
} from "../../../src/lib/blocks.ts";
import type { Case } from "./cases.ts";
import { blockPlain, estimateFill, fits } from "./fill.ts";
import type { ImageInfo } from "./seed.ts";
import { READ_ONLY_TOOLS, type ToolName } from "./tools.ts";

export type LoggedCall = {
  name: string;
  args: unknown;
  valid: boolean;
  mutated: boolean;
  result: string;
};

export type Score = {
  pass: boolean;
  failures: string[];
  calls: number;
  validPct: number;
  mutatingCalls: number;
  toolsUsed: string[];
  toolsMissing: string[];
  schemaValid: boolean;
  preserve: { mode: Case["expect"]["preserve"]; ok: boolean; detail: string };
  overflowPages: number[];
  finalFill: string;
};

/** Lowercased words, punctuation dropped except word-internal apostrophes. */
export function normalizedWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}'\s]+/gu, " ")
    .replace(/(^|\s)'+|'+(?=\s|$)/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function issueWords(content: IssueContent): string[] {
  return content.pages
    .filter((p) => !p.cover)
    .flatMap((p) => p.blocks.flatMap((b) => normalizedWords(blockPlain(b))));
}

function firstDiff(a: string[], b: string[]): string {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  if (i === n && a.length === b.length) return "identical";
  const ctx = (w: string[]) => w.slice(Math.max(0, i - 3), i + 4).join(" ");
  return `word ${i}: before "…${ctx(a)}…" / after "…${ctx(b)}…" (${a.length} → ${b.length} words)`;
}

/** Whether `needle` appears in order (not necessarily contiguous) in `hay`. */
function inOrder(
  needle: string[],
  hay: string[],
): { ok: boolean; missingAt: number } {
  let j = 0;
  for (let i = 0; i < needle.length; i++) {
    while (j < hay.length && hay[j] !== needle[i]) j++;
    if (j === hay.length) return { ok: false, missingAt: i };
    j++;
  }
  return { ok: true, missingAt: -1 };
}

export function scoreCase(
  c: Case,
  before: IssueContent,
  after: unknown,
  calls: LoggedCall[],
  attempted: number,
  images: Map<string, ImageInfo>,
): Score {
  const failures: string[] = [];
  const parsed = issueContentSchema.safeParse(after);
  if (!parsed.success) failures.push("final content fails issueContentSchema");
  const content = parsed.success ? parsed.data : before;

  const total = Math.max(attempted, calls.length);
  const valid = calls.filter((x) => x.valid).length;
  const mutating = calls.filter((x) => x.mutated).length;
  const used = [...new Set(calls.map((x) => x.name))];

  let preserve: Score["preserve"] = {
    mode: c.expect.preserve,
    ok: true,
    detail: "not checked",
  };
  if (c.expect.preserve === "page") {
    const d = firstDiff(issueWords(before), issueWords(content));
    preserve = { mode: "page", ok: d === "identical", detail: d };
  } else if (c.expect.preserve === "paste") {
    const needle = normalizedWords(c.paste ?? "");
    const r = inOrder(needle, issueWords(content));
    preserve = {
      mode: "paste",
      ok: r.ok,
      detail: r.ok
        ? `all ${needle.length} pasted words present in order`
        : `pasted word ${r.missingAt} ("${needle.slice(r.missingAt, r.missingAt + 6).join(" ")}…") not found in order`,
    };
  }
  if (!preserve.ok) failures.push(`wording: ${preserve.detail}`);

  const fills = content.pages.map((p) => estimateFill(p, images));
  const overflowPages = fills.flatMap((f, i) => (fits(f) ? [] : [i + 1]));
  if (c.expect.noOverflow && overflowPages.length)
    failures.push(`overflow (est.) on page ${overflowPages.join(", ")}`);
  if (c.expect.noEdits && mutating > 0)
    failures.push(`${mutating} edit(s) on a question-only case`);
  const forbidden = used.filter((n) => c.expect.forbiddenTools?.includes(n));
  if (forbidden.length)
    failures.push(`forbidden tool(s): ${forbidden.join(", ")}`);
  if (total > c.expect.maxCalls)
    failures.push(`${total} calls > max ${c.expect.maxCalls}`);

  const flow = fills.filter((f) => f.kind === "flow");
  return {
    pass: failures.length === 0,
    failures,
    calls: total,
    validPct: total ? Math.round((valid / total) * 100) : 100,
    mutatingCalls: mutating,
    toolsUsed: used,
    toolsMissing: c.expect.tools.filter(
      (t) =>
        !used.includes(t as ToolName) &&
        !READ_ONLY_TOOLS.includes(t as ToolName),
    ),
    schemaValid: parsed.success,
    preserve,
    overflowPages,
    finalFill: `max ~${Math.max(0, ...flow.map((f) => f.percent))}% over ${flow.length} pages`,
  };
}
