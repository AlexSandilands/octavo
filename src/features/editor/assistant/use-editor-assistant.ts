"use client";

import { useRef } from "react";
import { isPageOwning, type Page } from "@/lib/blocks";
import type { ResolvedImage } from "@/lib/images";
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
  overflowing,
  logos,
  logoId,
  sponsors,
  measure,
  apply,
  undo,
  historyTop,
  registerImage,
}: {
  issueId: string;
  /** The assistant only works on drafts. */
  published: boolean;
  title: string;
  theme: string;
  pages: Page[];
  curPage: number;
  sel: string | null;
  /** The id of the page the canvas finds running over, if it does. */
  overflowing: string | null;
  logos: LogoListItem[];
  logoId: string | null;
  sponsors: SponsorListItem[];
  measure: MeasurementOptions;
  apply: (next: EditorSnapshot, record: EditorSnapshot | null) => void;
  undo: () => void;
  historyTop: EditorSnapshot | null;
  /** A photo the author attached in the chat, for the canvas's image map (#343). */
  registerImage: (imageId: string, image: ResolvedImage) => void;
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
  const selected = page?.blocks.find((b) => b.id === sel);
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
        blockId: selected ? selected.id : null,
      },
      /** What the open page has, for the hints the panel offers (#366). */
      context: {
        overflow: Boolean(page && overflowing === page.id),
        photo: Boolean(
          page?.blocks.some((b) => b.type === "image" && !isPageOwning(b)),
        ),
        block: selected?.type === "text",
      },
      undo,
      historyTop,
      registerImage,
      askRef,
    },
  };
}
