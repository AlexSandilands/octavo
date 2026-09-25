// Scores one case's run (#315), lifted from the spike's scorer. Pass = the
// final issue passes issueContentSchema AND the wording check AND no page
// overflows (measured by the editor's own measurer) AND no edits / forbidden
// tools where the case says so AND calls ≤ maxCalls AND the run ended on its
// own AND the task was done (expect.done, checks.mts). `expect.tools` and
// `maxChangedBlocks` are reported, never failed on.
import {
  CONTENT_VERSION,
  issueContentSchema,
  type Block,
  type IssueContent,
  type Page,
} from "../../src/lib/blocks.ts";
import { richTextToPlain } from "../../src/lib/rich-text-doc.ts";
import type { PageFill } from "../../src/features/editor/assistant/page-fill.ts";
import type { Case } from "../fixtures/assistant/cases.mts";
import { doneFailures } from "./checks.mts";
import type { CaseRun } from "./conversation.mts";

export type Score = {
  pass: boolean;
  /** The task was done, by the case's own checks. */
  done: boolean;
  failures: string[];
  /** Reported, not failed on. */
  advisories: string[];
  calls: number;
  validPct: number;
  mutatingCalls: number;
  views: number;
  toolsUsed: string[];
  wording: {
    mode: Case["expect"]["preserve"];
    ok: boolean;
    /** Every word kept but out of order (articles swapped), or words changed. */
    change?: "order" | "words";
    detail: string;
  };
  pasteVerbatim: boolean | null;
  changedBlocks: number;
  overflowPages: number[];
};

const VIEW_TOOLS = new Set(["view_page", "view_photo"]);

function blockPlain(block: Block): string {
  if (block.type === "heading")
    return [block.kicker, block.title].filter(Boolean).join(" ");
  return block.type === "text" ? richTextToPlain(block.text) : "";
}

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

const issueWords = (c: IssueContent) =>
  c.pages
    .filter((p) => !p.cover)
    .flatMap((p) => p.blocks.flatMap((b) => normalizedWords(blockPlain(b))));

/** How two word runs differ: the same words out of order, or other words. */
const changeOf = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().join(" ") === [...b].sort().join(" ")
    ? ("order" as const)
    : ("words" as const);

function wordingOf(
  mode: Case["expect"]["preserve"],
  a: string[],
  b: string[],
): Score["wording"] {
  const detail = firstDiff(a, b);
  return detail === "identical"
    ? { mode, ok: true, detail }
    : { mode, ok: false, change: changeOf(a, b), detail };
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
function newBlockWords(
  before: IssueContent,
  after: IssueContent,
  textOnly = false,
) {
  const old = new Set(before.pages.flatMap((p) => p.blocks.map((b) => b.id)));
  return after.pages.flatMap((p) =>
    p.blocks
      .filter((b) => !old.has(b.id) && (!textOnly || b.type === "text"))
      .flatMap((b) => normalizedWords(blockPlain(b))),
  );
}

/** A pasted paragraph that reads as a heading: short, no closing punctuation. */
const headingLike = (para: string) =>
  para.split(/\s+/).length <= 6 && !/[.!:;]["'’”)]*$/.test(para);

/** The paste's body words as the new text should say them, in order; a
 *  heading-like line counts only where the text still holds it. */
function pasteBodyWords(paste: string, newText: string[]): string[] {
  const out: string[] = [];
  for (const para of paste.split(/\n\s*\n/).map((p) => p.trim())) {
    const words = normalizedWords(para);
    const here = newText.slice(out.length, out.length + words.length);
    if (!headingLike(para) || words.every((w, i) => here[i] === w))
      out.push(...words);
  }
  return out;
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
  startPages: Page[],
  run: CaseRun,
  fills: Record<string, PageFill>,
): Score {
  const failures: string[] = [];
  const parsed = issueContentSchema.safeParse({
    version: CONTENT_VERSION,
    pages: run.pages,
  });
  if (!parsed.success) failures.push("final content fails issueContentSchema");
  const before = issueContentSchema.parse({
    version: CONTENT_VERSION,
    pages: startPages,
  });
  const after = parsed.success ? parsed.data : before;

  const calls = run.calls.length;
  const valid = run.calls.filter((x) => x.valid).length;
  const mutating = run.calls.filter((x) => x.mutated).length;
  const used = [...new Set(run.calls.map((x) => x.name))];

  let wording: Score["wording"] = {
    mode: c.expect.preserve,
    ok: true,
    detail: "not checked",
  };
  let pasteVerbatim: boolean | null = null;
  const advisories: string[] = [];
  if (c.expect.preserve === "page") {
    wording = wordingOf("page", issueWords(before), issueWords(after));
  } else if (c.expect.preserve === "paste") {
    const text = newBlockWords(before, after, true);
    wording = wordingOf("paste", pasteBodyWords(c.paste ?? "", text), text);
    const exact = firstDiff(
      normalizedWords(c.paste ?? ""),
      newBlockWords(before, after),
    );
    pasteVerbatim = exact === "identical";
    if (!pasteVerbatim)
      advisories.push(`paste not verbatim incl. headings: ${exact}`);
  }
  if (!wording.ok)
    failures.push(
      `${wording.change === "order" ? "order changed (every word kept)" : "words changed"}: ${wording.detail}`,
    );

  const overflowPages = after.pages.flatMap((p, i) => {
    const f = fills[p.id];
    return f?.kind === "flow" && f.overflowLines > 0 ? [i + 1] : [];
  });
  if (c.expect.noOverflow && overflowPages.length)
    failures.push(`overflow on page ${overflowPages.join(", ")}`);
  if (c.expect.noEdits && mutating > 0)
    failures.push(`${mutating} edit(s) on a question-only case`);
  const forbidden = used.filter((n) => c.expect.forbiddenTools?.includes(n));
  if (forbidden.length)
    failures.push(`forbidden tool(s): ${forbidden.join(", ")}`);
  if (calls > c.expect.maxCalls)
    failures.push(`${calls} calls > max ${c.expect.maxCalls}`);
  if (run.stopped) failures.push(`stopped: ${run.stopped}`);
  const notDone = doneFailures(c.expect.done, {
    before: before.pages,
    after: after.pages,
    reply: run.reply,
  });
  failures.push(...notDone);

  const changed = changedBlocks(before, after);
  if (
    c.expect.maxChangedBlocks !== undefined &&
    changed > c.expect.maxChangedBlocks
  )
    advisories.push(
      `${changed} blocks changed (expected ≤ ${c.expect.maxChangedBlocks})`,
    );
  const missing = c.expect.tools.filter(
    (t) => !used.includes(t) && t !== "read_page",
  );
  if (missing.length) advisories.push(`unused: ${missing.join(", ")}`);

  return {
    pass: failures.length === 0,
    done: notDone.length === 0,
    failures,
    advisories,
    calls,
    validPct: calls ? Math.round((valid / calls) * 100) : 100,
    mutatingCalls: mutating,
    views: run.calls.filter((x) => VIEW_TOOLS.has(x.name)).length,
    toolsUsed: used,
    wording,
    pasteVerbatim,
    changedBlocks: changed,
    overflowPages,
  };
}
