"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  AI_MAX_TOOL_TEXT,
  aiToolSchemas,
  type AiToolOutput,
} from "@/lib/ai-tools";
import type { Page } from "@/lib/blocks";
import type { MeasurementOptions } from "../pdf-import/measure";
import type { EditorSnapshot } from "../use-editor-history";
import {
  createAssistantExecutor,
  type AssistantExecutor,
  type RunSummary,
} from "./executor";
import type { AssistantIssue } from "./issue-context";
import { createPageMeasurer } from "./measure-page";
import { pageView } from "./projection";
import { clip } from "./projection-text";

// The model's tools as the chat runs them (#306, #310): read_page from the
// projection, every other tool through the executor, which edits the editor's
// state. A bad argument or a refusal is an output the model reads, never a
// throw.

/** What the chat calls, at the start of a run, per tool call, and at its end. */
export type AssistantTools = {
  beginRun(): void;
  run(
    name: string,
    input: unknown,
    issue: AssistantIssue,
  ): Promise<AiToolOutput>;
  /** The run's change, for the panel's one line and its Undo; null if none. */
  endRun(): RunSummary | null;
  /** Non-null: stop the run and show this. */
  breaker(): string | null;
};

export function readPage(input: unknown, issue: AssistantIssue): AiToolOutput {
  const args = aiToolSchemas.read_page.safeParse(input);
  if (!args.success)
    return { text: "read_page needs a page number, like { page: 3 }." };
  return { text: clip(pageView(issue, args.data.page), AI_MAX_TOOL_TEXT) };
}

// A committed edit shows up in `pages` on the next render; give up waiting
// after this, since the next call re-reads the state anyway.
const RENDER_WAIT_MS = 2000;

export function useAssistantTools({
  state,
  apply,
  measure,
}: {
  state: EditorSnapshot;
  /** Commit the executor's pages, recording `record` as one undo step first. */
  apply: (next: EditorSnapshot, record: EditorSnapshot | null) => void;
  /** Everything a page's layout depends on besides its blocks. */
  measure: MeasurementOptions;
}): AssistantTools {
  const latest = useRef({ state, apply });
  const waiters = useRef<{ pages: Page[]; done: () => void }[]>([]);
  useEffect(() => {
    latest.current = { state, apply };
    waiters.current = waiters.current.filter((w) => {
      if (w.pages !== state.pages) return true;
      w.done();
      return false;
    });
  });

  const { theme, images, sponsors, settings, logo, issueNo } = measure;
  const measurer = useMemo(
    () =>
      typeof document === "undefined"
        ? null
        : createPageMeasurer({
            theme,
            images,
            sponsors,
            settings,
            logo,
            issueNo,
          }),
    [theme, images, sponsors, settings, logo, issueNo],
  );
  useEffect(() => () => measurer?.dispose(), [measurer]);

  const executor = useMemo<AssistantExecutor | null>(
    () =>
      measurer &&
      createAssistantExecutor({
        measure: measurer,
        handle: {
          state: () => latest.current.state,
          apply: (next, record) =>
            new Promise<void>((resolve) => {
              const timer = setTimeout(resolve, RENDER_WAIT_MS);
              waiters.current.push({
                pages: next.pages,
                done: () => {
                  clearTimeout(timer);
                  resolve();
                },
              });
              latest.current.apply(next, record);
            }),
        },
      }),
    [measurer],
  );

  return {
    beginRun: () => executor?.beginRun(),
    run: async (name, input, issue) =>
      executor
        ? executor.run(name, input, {
            photos: new Set(issue.uploads),
            read: (args) => readPage(args, issue),
          })
        : { text: "Error: the editor isn't ready yet. Nothing changed." },
    endRun: () => executor?.summary() ?? null,
    breaker: () => executor?.breaker() ?? null,
  };
}
