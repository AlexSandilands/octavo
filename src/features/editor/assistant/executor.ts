import { ZodError } from "zod";
import { CONTENT_VERSION, issueContentSchema, type Page } from "@/lib/blocks";
import {
  AI_MAX_TOOL_TEXT,
  aiToolSchemas,
  type AiToolName,
  type AiToolOutput,
} from "@/lib/ai-tools";
import type { EditorSnapshot } from "../use-editor-history";
import { applyEdit, Refusal } from "./edit-tools";
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

export type RunSummary = { text: string; blocks: number; pages: number[] };

export const RUN_CALL_LIMIT = 40;
export const RUN_MOVE_LIMIT = 2;
export const BREAKER_MESSAGE =
  "I got stuck, so I stopped. Everything I did is in place and can be undone in one step.";

type RunState = {
  calls: number;
  moves: Map<string, number>;
  /** The pages before the run's first change; null until it changes something. */
  start: Page[] | null;
};

const fresh = (): RunState => ({ calls: 0, moves: new Map(), start: null });

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
  /** read_page, answered from the projection's own view of the issue. */
  read: (input: unknown) => AiToolOutput;
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
    name: Exclude<AiToolName, "read_page">,
    input: unknown,
    photos: ReadonlySet<string>,
  ): Promise<string> => {
    const before = handle.state();
    try {
      const result = await applyEdit(
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
      if (handle.state().pages !== before.pages)
        return "Error: the author changed the issue while this edit was being measured; nothing changed. Read the page again and retry.";

      const record = run.start ? null : before;
      run.start ??= before.pages;
      const current = before.pages[before.curPage]?.id;
      const curPage = result.pages.findIndex((p) => p.id === current);
      const selKept = result.pages.some((p) =>
        p.blocks.some((b) => b.id === before.sel),
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
      return [result.text, ...lines].join(" ");
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
    return {
      text: clip(await edit(tool, input, call.photos), AI_MAX_TOOL_TEXT),
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
    /** Why the run should stop now (too many calls, a block moved back and forth), or null. */
    breaker(): string | null {
      const thrashing = [...run.moves.values()].some((n) => n > RUN_MOVE_LIMIT);
      return run.calls > RUN_CALL_LIMIT || thrashing ? BREAKER_MESSAGE : null;
    },
    /** What the run changed, for the panel's one line and its Undo; null if nothing. */
    summary(): RunSummary | null {
      return run.start ? summarizeRun(run.start, handle.state().pages) : null;
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

/** Blocks changed, added or removed between two documents, by page. */
export function summarizeRun(before: Page[], after: Page[]): RunSummary | null {
  const where = (pages: Page[]) => {
    const map = new Map<string, { json: string; page: number }>();
    pages.forEach((p, i) =>
      p.blocks.forEach((b) =>
        map.set(b.id, { json: JSON.stringify(b), page: i + 1 }),
      ),
    );
    return map;
  };
  const was = where(before);
  const now = where(after);
  const pageNos: number[] = [];
  let blocks = 0;
  for (const [id, b] of now) {
    if (was.get(id)?.json === b.json) continue;
    blocks++;
    pageNos.push(b.page);
  }
  for (const [id, b] of was) {
    if (now.has(id)) continue;
    blocks++;
    // A removed block is reported on its page as it stands now.
    const pageId = before[b.page - 1]!.id;
    const index = after.findIndex((p) => p.id === pageId);
    pageNos.push(index >= 0 ? index + 1 : b.page);
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
