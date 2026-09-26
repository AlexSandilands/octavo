import { ZodError } from "zod";
import { CONTENT_VERSION, issueContentSchema, type Page } from "@/lib/blocks";
import {
  AI_MAX_TOOL_TEXT,
  aiToolSchemas,
  type AiReadOnlyTool,
  type AiToolName,
  type AiToolOutput,
  type AiViewTool,
} from "@/lib/ai-tools";
import type { EditorSnapshot } from "../use-editor-history";
import { applyEdit, Refusal } from "./edit-tools";
import { applyCoverTool, isCoverTool } from "./cover-tools";
import { describeReport, type EditMeasurer } from "./page-report";
import { clip } from "./projection-text";

// Runs the model's editing tools against the editor's state (#310). Every call
// is validated, applied to a copy, re-validated whole with the save path's
// schema, and only then committed through the editor — so a refused or invalid
// edit changes nothing, and each call is answered with the touched pages' fill.
// A run (one author message) records ONE history step, before its first
// change: Ctrl/Cmd+Z takes back everything the run did.

/** How the executor reaches the editor. `apply` resolves once it has rendered. */
export type AssistantEditorHandle = {
  state(): EditorSnapshot;
  apply(next: EditorSnapshot, record: EditorSnapshot | null): Promise<void>;
};

export type RunChange = { text: string; blocks: number; pages: number[] };
export type RunSummary = RunChange & {
  /** The run's one history step: its Undo is offered while that is on top. */
  step: EditorSnapshot;
};

export const RUN_CALL_LIMIT = 40;
export const RUN_MOVE_LIMIT = 2;
export const BREAKER_MESSAGE =
  "I got stuck, so I stopped. Everything I did is in place and can be undone in one step.";
export const INTERRUPTED_MESSAGE =
  "The issue changed while I was working, so I stopped. What I'd done is still in place; Ctrl+Z (⌘Z on a Mac) takes back your change first, then mine.";

type RunState = {
  calls: number;
  moves: Map<string, number>;
  /** The step recorded before the run's first change; null until it changes something. */
  step: EditorSnapshot | null;
  /** The pages as the run last left them. */
  last: Page[] | null;
  /** Something else changed the pages mid-run: it stops. */
  interrupted: boolean;
  /** The cover this run's compose calls edit, once one has (#313). */
  cover: { id?: string };
};

const fresh = (): RunState => ({
  calls: 0,
  moves: new Map(),
  step: null,
  last: null,
  interrupted: false,
  cover: {},
});

/** The first key an edit set that the save path's schema would drop, if any:
 *  what the editor shows must be what the issue stores. */
function droppedKey(set: unknown, kept: unknown, at = "pages"): string | null {
  if (Array.isArray(set))
    return set.reduce<string | null>(
      (found, v, i) =>
        found ?? droppedKey(v, (kept as unknown[])?.[i], `${at}[${i}]`),
      null,
    );
  if (!set || typeof set !== "object") return null;
  for (const [key, value] of Object.entries(set)) {
    if (value === undefined) continue;
    if (!kept || typeof kept !== "object" || !(key in kept))
      return `${at}.${key}`;
    const deeper = droppedKey(
      value,
      (kept as Record<string, unknown>)[key],
      `${at}.${key}`,
    );
    if (deeper) return deeper;
  }
  return null;
}

const CHANGED_UNDER_RUN =
  "Error: the issue changed while you were working (the author edited it, or undid your changes), so this run has stopped; nothing more changed.";

function argumentError(name: string, error: ZodError): string {
  const issue = error.issues[0];
  const where = issue
    ? ` (${issue.path.join(".") || "input"}: ${issue.message})`
    : "";
  return `Error: invalid arguments for ${name}${where}. Nothing changed.`;
}

/** What one call needs from the issue as the model last saw it. */
export type CallContext = {
  /** Photos uploaded to this issue: the only ones insert_blocks places. */
  photos: ReadonlySet<string>;
  /** The logo library, for add_logo (#313). */
  logos: readonly { id: string; name: string; imageId: string }[];
  /** read_page, answered from the projection's own view of the issue. */
  read: (input: unknown) => AiToolOutput;
  /** view_page / view_photo (#342): a picture, within the run's view budget. */
  view: (tool: AiViewTool, input: unknown) => Promise<AiToolOutput>;
};

export function createAssistantExecutor({
  handle,
  measure,
}: {
  handle: AssistantEditorHandle;
  measure: EditMeasurer;
}) {
  let run = fresh();
  // Calls run one at a time, each on the state the one before it left.
  let queue: Promise<unknown> = Promise.resolve();

  const edit = async (
    name: Exclude<AiToolName, AiReadOnlyTool>,
    input: unknown,
    call: CallContext,
  ): Promise<string> => {
    const before = handle.state();
    // One run is one undo step only while nothing else has changed the pages
    // since its last edit: a change between calls stops the run.
    if (run.interrupted || (run.last && before.pages !== run.last)) {
      run.interrupted = true;
      return CHANGED_UNDER_RUN;
    }
    try {
      const { photos, logos } = call;
      const result = isCoverTool(name)
        ? await applyCoverTool(
            {
              pages: before.pages,
              curPage: before.curPage,
              photos,
              logos,
              measure,
              pin: run.cover,
            },
            name,
            input,
          )
        : await applyEdit(
            { pages: before.pages, photos, measure },
            name,
            input,
          );
      const valid = issueContentSchema.safeParse({
        version: CONTENT_VERSION,
        pages: result.pages,
      });
      if (!valid.success)
        return `Error: that edit would make the issue invalid (${valid.error.issues[0]?.message}); nothing changed.`;
      const dropped = droppedKey(result.pages, valid.data.pages);
      if (dropped)
        return `Error: that edit sets something the issue can't store (${dropped}); nothing changed.`;
      if (handle.state().pages !== before.pages) {
        run.interrupted = true;
        return CHANGED_UNDER_RUN;
      }

      const record = run.step ? null : before;
      run.step ??= before;
      const current = before.pages[before.curPage]?.id;
      const curPage = result.pages.findIndex((p) => p.id === current);
      const selKept = result.pages.some(
        (p) =>
          p.blocks.some((b) => b.id === before.sel) ||
          p.coverElements?.some((e) => e.id === before.sel),
      );
      await handle.apply(
        {
          pages: result.pages,
          curPage:
            curPage >= 0
              ? curPage
              : Math.min(before.curPage, result.pages.length - 1),
          sel: selKept ? before.sel : null,
        },
        record,
      );
      run.last = result.pages;
      if (result.moved)
        run.moves.set(result.moved, (run.moves.get(result.moved) ?? 0) + 1);

      const lines: string[] = [];
      for (const id of result.report) {
        const index = result.pages.findIndex((p) => p.id === id);
        const page = result.pages[index];
        if (page)
          lines.push(
            describeReport(index + 1, page, await measure.report(page)),
          );
      }
      return [result.text, lines.join("; ")].filter(Boolean).join(" ");
    } catch (error) {
      if (error instanceof Refusal)
        return `Error: ${error.message}. Nothing changed.`;
      if (error instanceof ZodError) return argumentError(name, error);
      throw error;
    }
  };

  const runOne = async (
    name: string,
    input: unknown,
    call: CallContext,
  ): Promise<AiToolOutput> => {
    run.calls++;
    if (!Object.hasOwn(aiToolSchemas, name))
      return { text: `Error: there is no tool "${name}".` };
    const tool = name as AiToolName;
    if (tool === "read_page") return call.read(input);
    if (tool === "view_page" || tool === "view_photo")
      return call.view(tool, input);
    return {
      text: clip(await edit(tool, input, call), AI_MAX_TOOL_TEXT),
    };
  };

  return {
    /** A new author message: counters reset, and the next change records a step. */
    beginRun() {
      run = fresh();
    },
    run(
      name: string,
      input: unknown,
      call: CallContext,
    ): Promise<AiToolOutput> {
      const next = queue.then(() => runOne(name, input, call));
      queue = next.catch(() => undefined);
      return next;
    },
    /** Why the run should stop now (too many calls, a block moved back and
     *  forth, the issue changed under it), or null. */
    breaker(): string | null {
      if (run.interrupted) return INTERRUPTED_MESSAGE;
      const thrashing = [...run.moves.values()].some((n) => n > RUN_MOVE_LIMIT);
      return run.calls > RUN_CALL_LIMIT || thrashing ? BREAKER_MESSAGE : null;
    },
    /** What the run itself changed, for the panel's one line and its Undo; null if nothing. */
    summary(): RunSummary | null {
      if (!run.step || !run.last) return null;
      const change = summarizeRun(run.step.pages, run.last);
      return change && { ...change, step: run.step };
    },
  };
}

export type AssistantExecutor = ReturnType<typeof createAssistantExecutor>;

/** "4–5", "2, 4–5 and 7". */
export function formatPages(numbers: number[]): string {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  const runs: string[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (sorted[j + 1] === sorted[j]! + 1) j++;
    runs.push(i === j ? `${sorted[i]}` : `${sorted[i]}–${sorted[j]}`);
    i = j + 1;
  }
  return runs.length > 1
    ? `${runs.slice(0, -1).join(", ")} and ${runs.at(-1)}`
    : (runs[0] ?? "");
}

/**
 * The blocks of `ids` that moved within a page: every one not on its longest
 * run still in the old order (one moved paragraph is one, not its neighbours).
 */
function reordered(ids: string[], order: Map<string, number>): string[] {
  const at = ids.map((id) => order.get(id)!);
  const best = at.map(() => 1);
  const prev = at.map(() => -1);
  for (let i = 0; i < at.length; i++)
    for (let j = 0; j < i; j++)
      if (at[j]! < at[i]! && best[j]! + 1 > best[i]!) {
        best[i] = best[j]! + 1;
        prev[i] = j;
      }
  const keep = new Set<number>();
  for (let i = best.indexOf(Math.max(0, ...best)); i >= 0; i = prev[i]!)
    keep.add(i);
  return ids.filter((_, i) => !keep.has(i));
}

/** Blocks changed, moved, added or removed between two documents, by page. */
export function summarizeRun(before: Page[], after: Page[]): RunChange | null {
  type At = { json: string; page: number; pageId: string; index: number };
  const where = (pages: Page[]) => {
    const map = new Map<string, At>();
    pages.forEach((p, i) =>
      p.blocks.forEach((b, index) =>
        map.set(b.id, {
          json: JSON.stringify(b),
          page: i + 1,
          pageId: p.id,
          index,
        }),
      ),
    );
    return map;
  };
  const was = where(before);
  const now = where(after);
  const touched = new Map<string, number>();
  for (const [id, b] of now) {
    const old = was.get(id);
    if (!old || old.json !== b.json || old.pageId !== b.pageId)
      touched.set(id, b.page);
  }
  for (const p of after) {
    const stayed = p.blocks
      .map((b) => b.id)
      .filter((id) => was.get(id)?.pageId === p.id && !touched.has(id));
    const order = new Map(stayed.map((id) => [id, was.get(id)!.index]));
    for (const id of reordered(stayed, order))
      touched.set(id, now.get(id)!.page);
  }
  const pageNos = [...touched.values()];
  let blocks = touched.size;
  for (const [id, b] of was) {
    if (now.has(id)) continue;
    blocks++;
    // A removed block is reported on its page as it stands now.
    const index = after.findIndex((p) => p.id === b.pageId);
    pageNos.push(index >= 0 ? index + 1 : b.page);
  }
  // Cover items (#313) count like blocks; a cover-wide change counts once.
  for (const [i, p] of after.entries()) {
    const old = before.find((q) => q.id === p.id);
    if (!old?.cover && !p.cover) continue;
    const els = new Map((old?.coverElements ?? []).map((e) => [e.id, e]));
    let n = 0;
    for (const e of p.coverElements ?? []) {
      const was = els.get(e.id);
      if (!was || JSON.stringify(was) !== JSON.stringify(e)) n++;
      els.delete(e.id);
    }
    n += els.size;
    if (JSON.stringify(old?.coverOverlay) !== JSON.stringify(p.coverOverlay))
      n = Math.max(n, 1);
    if (!n) continue;
    blocks += n;
    pageNos.push(i + 1);
  }
  const added = after.length - before.length;
  if (!blocks && added <= 0) return null;
  const pages = [...new Set(pageNos)].sort((a, b) => a - b);
  const parts: string[] = [];
  if (blocks)
    parts.push(
      `Changed ${blocks === 1 ? "1 block" : `${blocks} blocks`} on ${pages.length === 1 ? "page" : "pages"} ${formatPages(pages)}`,
    );
  if (added > 0)
    parts.push(`added ${added === 1 ? "1 page" : `${added} pages`}`);
  const text = parts.join(" and ");
  return { text: text[0]!.toUpperCase() + text.slice(1), blocks, pages };
}
