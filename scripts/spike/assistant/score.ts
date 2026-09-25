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
  /** Reported, not failed on. */
  advisories: string[];
  changedBlocks: number;
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

/** Words of the blocks that weren't in `before`, in document order. */
function newBlockWords(before: IssueContent, after: IssueContent): string[] {
  const old = new Set(before.pages.flatMap((p) => p.blocks.map((b) => b.id)));
  return after.pages.flatMap((p) =>
    p.blocks
      .filter((b) => !old.has(b.id))
      .flatMap((b) => normalizedWords(blockPlain(b))),
  );
}

/** Blocks added, deleted or edited (moves alone don't count). */
function changedBlocks(before: IssueContent, after: IssueContent): number {
  const flat = (c: IssueContent) =>
    new Map(
      c.pages.flatMap((p) =>
        p.blocks.map((b) => [b.id, JSON.stringify(b)] as const),
      ),
    );
  const a = flat(before);
  const b = flat(after);
  let n = 0;
  for (const [id, json] of a) if (b.get(id) !== json) n++;
  for (const id of b.keys()) if (!a.has(id)) n++;
  return n;
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
    // The new blocks, read in order, must say exactly what was pasted.
    const d = firstDiff(
      normalizedWords(c.paste ?? ""),
      newBlockWords(before, content),
    );
    preserve = { mode: "paste", ok: d === "identical", detail: d };
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

  // Advisory, like expect.tools: reported, never failed on.
  const changed = changedBlocks(before, content);
  const advisories =
    c.expect.maxChangedBlocks !== undefined &&
    changed > c.expect.maxChangedBlocks
      ? [`${changed} blocks changed (expected ≤ ${c.expect.maxChangedBlocks})`]
      : [];

  const flow = fills.filter((f) => f.kind === "flow");
  return {
    changedBlocks: changed,
    advisories,
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
