"use client";

import { useEffect, useRef, useState } from "react";
import {
  AI_MAX_TOOL_TEXT,
  aiToolSchemas,
  type AiToolOutput,
} from "@/lib/ai-tools";
import type { AiRenderedPage } from "@/lib/ai-vision-contract";
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
import { createVision, picturePages, type VisionSource } from "./vision";

// The model's tools as the chat runs them (#306, #310): read_page from the
// projection, every other tool through the executor, which edits the editor's
// state. A bad argument or a refusal is an output the model reads, never a
// throw.

/** What the chat calls, at the start of a run, per tool call, and at its end. */
export type AssistantTools = {
  /** `pictures`: how many more images the conversation has room for. */
  beginRun(pictures: number): void;
  run(
    name: string,
    input: unknown,
    issue: AssistantIssue,
  ): Promise<AiToolOutput>;
  /** The run's change, for the panel's one line and its Undo; null if none. */
  endRun(): RunSummary | null;
  /** Non-null: stop the run and show this. */
  breaker(): string | null;
  /** A run is under way: the editor keeps the author's hands off the canvas. */
  running: boolean;
  /** What the run has changed so far, without ending it (the review asks, #342). */
  summary(): RunSummary | null;
  /** Pictures of pages as members will see them, for the end-of-run review (#342). */
  picture(pages: number[], issue: AssistantIssue): Promise<AiRenderedPage[]>;
  /** Pictures the conversation still has room for, after this run's views. */
  pictureRoom(): number;
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
  source,
}: {
  state: EditorSnapshot;
  /** Commit the executor's pages, recording `record` as one undo step first. */
  apply: (next: EditorSnapshot, record: EditorSnapshot | null) => void;
  /** Everything a page's layout depends on besides its blocks. */
  measure: MeasurementOptions;
  /** The issue and its footer mark, for page pictures (#342). */
  source: VisionSource;
}): AssistantTools {
  const latest = useRef({ state, apply });
  const pictured = useRef(source);
  useEffect(() => {
    pictured.current = source;
  });
  const [vision] = useState(createVision);
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
  // A new measurer (and an empty cache) whenever the page chrome changes.
  const measurer = useRef<ReturnType<typeof createPageMeasurer> | null>(null);
  useEffect(() => {
    const next = createPageMeasurer({
      theme,
      images,
      sponsors,
      settings,
      logo,
      issueNo,
    });
    measurer.current = next;
    return () => {
      next.dispose();
      if (measurer.current === next) measurer.current = null;
    };
  }, [theme, images, sponsors, settings, logo, issueNo]);

  // One executor for the editor's life, so a run survives a chrome change.
  const executor = useRef<AssistantExecutor | null>(null);
  useEffect(() => {
    const measured = () =>
      measurer.current ?? Promise.reject(new Error("The editor isn't ready."));
    executor.current ??= createAssistantExecutor({
      measure: {
        report: async (page) => (await measured()).report(page),
        textFlow: async (blocks, id) => (await measured()).textFlow(blocks, id),
        cover: async (page, pages) => (await measured()).cover(page, pages),
      },
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
    });
  }, []);

  const [running, setRunning] = useState(false);
  return {
    running,
    beginRun: (pictures) => {
      setRunning(true);
      executor.current?.beginRun();
      vision.beginRun(pictures);
    },
    run: async (name, input, issue) =>
      executor.current
        ? executor.current.run(name, input, {
            photos: new Set(issue.uploads),
            logos: issue.logos,
            read: (args) => readPage(args, issue),
            view: (tool, args) =>
              vision.view(tool, args, issue, pictured.current),
          })
        : { text: "Error: the editor isn't ready yet. Nothing changed." },
    endRun: () => {
      setRunning(false);
      return executor.current?.summary() ?? null;
    },
    breaker: () => executor.current?.breaker() ?? null,
    summary: () => executor.current?.summary() ?? null,
    picture: (pages, issue) => picturePages(pictured.current, issue, pages),
    pictureRoom: vision.room,
  };
}
