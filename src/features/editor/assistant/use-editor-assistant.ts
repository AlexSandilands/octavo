"use client";

import { useRef } from "react";
import type { Page } from "@/lib/blocks";
import type { LogoListItem } from "@/lib/logos";
import type { SponsorListItem } from "@/lib/sponsors";
import type { MeasurementOptions } from "../pdf-import/measure";
import type { EditorSnapshot } from "../use-editor-history";
import { assistantEnabled } from "./enabled";
import type { AskHandler } from "./presets";
import { useAssistantSnapshot } from "./use-assistant-snapshot";
import { useAssistantTools } from "./tools";

// The editor's assistant wiring (#306): what it reads, the tools it runs, and
// the Ask on a block, which sends through the side panel's conversation.
export function useEditorAssistant({
  issueId,
  published,
  title,
  theme,
  pages,
  curPage,
  sel,
  logos,
  logoId,
  sponsors,
  measure,
  apply,
  undo,
  historyTop,
}: {
  issueId: string;
  /** The assistant only works on drafts. */
  published: boolean;
  title: string;
  theme: string;
  pages: Page[];
  curPage: number;
  sel: string | null;
  logos: LogoListItem[];
  logoId: string | null;
  sponsors: SponsorListItem[];
  measure: MeasurementOptions;
  apply: (next: EditorSnapshot, record: EditorSnapshot | null) => void;
  undo: () => void;
  historyTop: EditorSnapshot | null;
}) {
  const askRef = useRef<AskHandler | null>(null);
  const snapshot = useAssistantSnapshot({
    title,
    theme,
    pages,
    curPage,
    logos,
    sponsors,
    measure,
  });
  const tools = useAssistantTools({
    state: { pages, curPage, sel },
    apply,
    measure,
    source: { issueId, logoId },
  });
  const ask: AskHandler | undefined =
    assistantEnabled && !published
      ? async (id, text) =>
          (await askRef.current?.(id, text)) ?? { ok: false, reason: "failed" }
      : undefined;
  const page = pages[curPage];
  return {
    tools,
    ask,
    /** The side panel's view of it. The target is a block on an inside page,
     *  for the presets; a cover's only preset works on the whole cover, and a
     *  cover item's Ask sends its own id. */
    side: {
      issueId,
      published,
      snapshot,
      tools,
      target: {
        page: curPage + 1,
        blockId: page?.blocks.some((b) => b.id === sel) ? sel : null,
      },
      undo,
      historyTop,
      askRef,
    },
  };
}
