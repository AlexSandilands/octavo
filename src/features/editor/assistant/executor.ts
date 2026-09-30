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
import type { PageRead } from "./projection";
import { clip } from "./projection-text";
import { markRead, markWritten, unseenText, type SeenText } from "./seen-text";
import { formatPages } from "./page-numbers";
export { formatPages };

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
/** Re-trims of a block, in a row, on a page that still overflows (#355). */
export const RUN_STALL_LIMIT = 4;
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
  /** Lines the author's run summary adds (a photo a plan suggested). */
  notes: string[];
  /** Aborted when the run ends or is stopped: a call still working gives up. */
  abort: AbortController;
  /** The cover this run's compose calls edit, once one has (#313). */
  cover: { id?: string };
  stall: Stall;
  /** Long text blocks the model has had whole this run: see seen-text.ts. */
  seen: SeenText;
};

/** set_text calls in a row on one page that still overflows after each; a
 *  block rewritten again in that streak is a repeat (#355). */
type Stall = { pageId: string | null; blocks: Set<string>; repeats: number };
const noStall = (): Stall => ({ pageId: null, blocks: new Set(), repeats: 0 });

/** Trimming a line a call makes progress every few calls, so neither the call
 *  ceiling nor the move rule caught it; one pass over many blocks isn't a stall. */
function trackStall(
  s: Stall,
  name: string,
  input: unknown,
  pageId: string | undefined,
  over: boolean,
): Stall {
  const blockId = (input as { blockId?: string }).blockId;
  if (name !== "set_text" || !blockId || !pageId || !over) return noStall();
  if (s.pageId !== pageId)
    return { pageId, blocks: new Set([blockId]), repeats: 0 };
  if (s.blocks.has(blockId)) return { ...s, repeats: s.repeats + 1 };
  return { ...s, blocks: new Set(s.blocks).add(blockId) };
}

const fresh = (): RunState => ({
  calls: 0,
  moves: new Map(),
  step: null,
  last: null,
  interrupted: false,
  notes: [],
  abort: new AbortController(),
  cover: {},
  stall: noStall(),
  seen: new Map(),
});

const STOPPED =
  "Error: this run was stopped before the edit landed; nothing changed.";

/** Every object in the issue before an edit: the executor copies only what it
 *  edits, so an object seen here is one the edit didn't write. */
export function objectsIn(value: unknown, into = new WeakSet<object>()) {
  if (value && typeof value === "object" && !into.has(value)) {
    into.add(value);
    for (const v of Object.values(value)) objectsIn(v, into);
  }
  return into;
}

/** The first key an edit wrote that the save path's schema would drop, if any:
 *  what the editor shows must be what the issue stores. What was there before
 *  isn't the edit's, so it's skipped; so is rich text, where the save trimming
 *  Tiptap's attributes (a link's target, a list's start) is the editor's norm. */
export function droppedKey(
  set: unknown,
  kept: unknown,
  before: WeakSet<object>,
  at = "pages",
): string | null {
  if (!set || typeof set !== "object" || before.has(set)) return null;
  if ((set as { type?: unknown }).type === "doc") return null;
  if (Array.isArray(set))
    return set.reduce<string | null>(
      (found, v, i) =>
        found ?? droppedKey(v, (kept as unknown[])?.[i], before, `${at}[${i}]`),
      null,
    );
  for (const [key, value] of Object.entries(set)) {
    if (value === undefined) continue;
    if (!kept || typeof kept !== "object" || !(key in kept))
      return `${at}.${key}`;
    const deeper = droppedKey(
      value,
      (kept as Record<string, unknown>)[key],
      before,
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
  read: (input: unknown) => PageRead;
  /** Which of the model's replies made this call: one reply's calls were all
   *  written before any was answered (seen-text.ts). Counts up, never back. */
  reply: number;
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
    mine: RunState,
    name: Exclude<AiToolName, AiReadOnlyTool>,
    input: unknown,
    call: CallContext,
  ): Promise<string> => {
    const before = handle.state();
    // A call that outlives its run (Stop, or a new message) lands nowhere.
    const gone = () => run !== mine || mine.abort.signal.aborted;
    if (gone()) return STOPPED;
    // One run is one undo step only while nothing else has changed the pages
    // since its last edit: a change between calls stops the run.
    if (mine.interrupted || (mine.last && before.pages !== mine.last)) {
      mine.interrupted = true;
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
              pin: mine.cover,
            },
            name,
            input,
          )
        : await applyEdit(
            { pages: before.pages, photos, measure, signal: mine.abort.signal },
            name,
            input,
          );
      if (gone()) return STOPPED;
      const valid = issueContentSchema.safeParse({
        version: CONTENT_VERSION,
        pages: result.pages,
      });
      if (!valid.success)
        return `Error: that edit would make the issue invalid (${valid.error.issues[0]?.message}); nothing changed.`;
      const was = objectsIn(before.pages);
      const dropped = droppedKey(result.pages, valid.data.pages, was);
      if (dropped)
        return `Error: that edit sets something the issue can't store (${dropped}); nothing changed.`;
      if (handle.state().pages !== before.pages) {
        mine.interrupted = true;
        return CHANGED_UNDER_RUN;
      }

      const record = mine.step ? null : before;
      mine.step ??= before;
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
      mine.last = result.pages;
      if (name === "set_text" || name === "insert_blocks")
        markWritten(mine.seen, result.pages, was);
      mine.notes.push(...(result.notes ?? []));
      if (result.moved)
        mine.moves.set(result.moved, (mine.moves.get(result.moved) ?? 0) + 1);

      const lines: string[] = [];
      let over = false;
      for (const id of result.report) {
        const index = result.pages.findIndex((p) => p.id === id);
        const page = result.pages[index];
        if (!page) continue;
        const report = await measure.report(page);
        over ||= report.fill?.kind === "flow" && report.fill.overflowLines > 0;
        lines.push(describeReport(index + 1, page, report));
      }
      mine.stall = trackStall(mine.stall, name, input, result.report[0], over);
      return [result.text, lines.join("; ")].filter(Boolean).join(" ");
    } catch (error) {
      if (gone()) return STOPPED;
      if (error instanceof Refusal)
        return `Error: ${error.message}. Nothing changed.`;
      if (error instanceof ZodError) return argumentError(name, error);
      throw error;
    }
  };

  const runOne = async (
    mine: RunState,
    name: string,
    input: unknown,
    call: CallContext,
  ): Promise<AiToolOutput> => {
    mine.calls++;
    if (!Object.hasOwn(aiToolSchemas, name))
      return { text: `Error: there is no tool "${name}".` };
    const tool = name as AiToolName;
    if (tool === "read_page") {
      const { text, whole } = call.read(input);
      markRead(mine.seen, whole, call.reply);
      return { text };
    }
    if (tool === "set_text") {
      const refused = unseenText(
        mine.seen,
        handle.state().pages,
        input,
        call.reply,
        (page) => call.read({ page }).whole,
      );
      if (refused) return { text: refused };
    }
    if (tool === "view_page" || tool === "view_photo")
      return call.view(tool, input);
    return {
      text: clip(await edit(mine, tool, input, call), AI_MAX_TOOL_TEXT),
    };
  };

  return {
    /** A new author message: counters reset, and the next change records a step. */
    beginRun() {
      run.abort.abort();
      run = fresh();
      // A cover open as the author asks is the run's cover from the start.
      const { pages, curPage } = handle.state();
      if (pages[curPage]?.cover) run.cover.id = pages[curPage].id;
    },
    /** The run is over (it ended or was stopped): a call still working gives up. */
    abort() {
      run.abort.abort();
    },
    run(
      name: string,
      input: unknown,
      call: CallContext,
    ): Promise<AiToolOutput> {
      // A call belongs to the run it was made in, even if it waits its turn.
      const mine = run;
      const next = queue.then(() => runOne(mine, name, input, call));
      queue = next.catch(() => undefined);
      return next;
    },
    /** Why the run should stop now (too many calls, a block moved back and
     *  forth, trimming that stalls, the issue changed under it), or null. */
    breaker(): string | null {
      if (run.interrupted) return INTERRUPTED_MESSAGE;
      const thrashing =
        [...run.moves.values()].some((n) => n > RUN_MOVE_LIMIT) ||
        run.stall.repeats >= RUN_STALL_LIMIT;
      return run.calls > RUN_CALL_LIMIT || thrashing ? BREAKER_MESSAGE : null;
    },
    /** What the run itself changed, for the panel's one line and its Undo; null if nothing. */
    summary(): RunSummary | null {
      if (!run.step || !run.last) return null;
      const change = summarizeRun(run.step.pages, run.last);
      if (!change) return null;
      const text = [change.text, ...run.notes].join(". ");
      return {
        ...change,
        text: run.notes.length ? `${text}.` : text,
        step: run.step,
      };
    },
  };
}

export type AssistantExecutor = ReturnType<typeof createAssistantExecutor>;

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
