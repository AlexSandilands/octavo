"use client";

import {
  useEffect,
  useState,
  type ComponentProps,
  type RefObject,
} from "react";
import dynamic from "next/dynamic";
import type { Page } from "@/lib/blocks";
import { collectImageIds, type ResolvedImage } from "@/lib/images";
import { AssistantPanel, budgetSpent } from "./assistant/assistant-panel";
import { assistantEnabled } from "./assistant/enabled";
import {
  useAssistantChat,
  type AssistantSnapshot,
} from "./assistant/use-assistant-chat";
import {
  askMessage,
  type AskHandler,
  type PresetTarget,
} from "./assistant/presets";
import type { EditorSnapshot } from "./use-editor-history";
import type { AssistantTools } from "./assistant/tools";
import { useAssistantUsage } from "./assistant/use-assistant-usage";
import { useAttachments } from "./assistant/use-attachments";
import { useConfirmedSend } from "./assistant/use-confirmed-send";
import { SidePanel } from "./side-panel/side-panel";
import { SurfaceChoice } from "./side-panel/surface-choice";
import { SurfaceStrip, tabId } from "./side-panel/surface-strip";
import { PANEL_ID, type SurfaceAction } from "./side-panel/surfaces";
import type { usePanelWidth } from "./side-panel/use-panel-width";
import type { useSurfaces } from "./side-panel/use-surfaces";
import type { DropHandler } from "./use-pdf-drag-out";

// The importer and its parser load only when the surface is opened.
const PdfImportPanel = dynamic(() => import("./pdf-import/panel"), {
  ssr: false,
});
const TABPANEL_ID = "editor-surface";
const ASSISTANT_INPUT_ID = "assistant-input";
/** A question already up takes the focus on its first button (#312). */
const QUESTION_FOCUS = "[data-assistant-paste-confirm] button";
export const PDF_COVER_DESCRIPTION =
  "PDF import is available on interior pages. Move to another page to use it.";

// The editor's right-hand side (#353): the sliding panel, with a strip of
// tabs along its top — one per open surface — and the active surface below.
// Every open surface stays mounted (an inactive Import PDF keeps its file, an
// inactive Assistant its unsent words) until its tab or the panel closes. The
// assistant's conversation lives here rather than in its panel, so neither
// ends it.
export function EditorSide({
  surfaces,
  pending,
  cover,
  panel,
  pages,
  onAdd,
  dropRef,
  assistant,
}: {
  surfaces: ReturnType<typeof useSurfaces>;
  /** An import is landing: the strip sits out until it has. */
  pending: boolean;
  cover: boolean;
  panel: ReturnType<typeof usePanelWidth>;
  pages: Page[];
  onAdd: ComponentProps<typeof PdfImportPanel>["onAdd"];
  dropRef: RefObject<DropHandler | null>;
  assistant: {
    issueId: string;
    published: boolean;
    snapshot: AssistantSnapshot;
    tools: AssistantTools;
    /** The page open now and its selected block, for the presets. */
    target: PresetTarget;
    context: ComponentProps<typeof AssistantPanel>["context"];
    /** The editor's own Undo: a run is one step. */
    undo: () => void;
    historyTop: EditorSnapshot | null;
    /** A photo attached in the chat (#343) joins the editor's photos. */
    registerImage: (imageId: string, image: ResolvedImage) => void;
    /** Set here: the Ask box on a block sends through this conversation. */
    askRef: RefObject<AskHandler | null>;
  };
}) {
  const [pdfActions, setPdfActions] = useState<SurfaceAction[]>([]);
  const { active, open } = surfaces;
  const assistantShown = open && active?.kind === "assistant";
  const usage = useAssistantUsage(
    assistantEnabled && !assistant.published,
    assistantShown,
  );
  const chat = useAssistantChat({
    issueId: assistant.issueId,
    snapshot: assistant.snapshot,
    tools: assistant.tools,
    onRunEnd: () => void usage.refresh(),
  });
  // Photos waiting in the composer (#343): here with the conversation, so
  // closing the panel keeps them. The last run's that no page places now.
  const attachments = useAttachments({
    issueId: assistant.issueId,
    onUploaded: assistant.registerImage,
  });
  // Every surface sends through here, so a long message always asks first (#312).
  const gate = useConfirmedSend(chat);
  const placed = new Set(collectImageIds({ pages }));
  const unplaced = chat.runPhotos.filter((id) => !placed.has(id)).length;
  // An Ask opens the assistant on the run (or on why it can't take one, or on
  // the long-paste question); an open one takes the focus, as it does on
  // opening, with Stop at hand.
  const { askRef } = assistant;
  useEffect(() => {
    askRef.current = async (blockId, text) => {
      if (!assistantShown) surfaces.openSurface("assistant");
      else
        document
          .querySelector<HTMLElement>(
            gate.pending ? QUESTION_FOCUS : `#${ASSISTANT_INPUT_ID}`,
          )
          ?.focus();
      // The editor fetches the figure on opening; if it hasn't landed, ask.
      const now = usage.usage ?? (await usage.refresh());
      if (budgetSpent(chat, now)) return { ok: false, reason: "spent" };
      return gate.ask({
        text: askMessage({ page: assistant.target.page, blockId, cover }, text),
        attachments: [],
      });
    };
  });
  // Each opening takes the focus into the panel: the assistant's composer
  // takes it itself; the choice's first button or Import PDF's tab here.
  useEffect(() => {
    if (!open) return;
    const target = active
      ? active.kind === "pdf"
        ? document.getElementById(tabId(active.id))
        : null
      : document.querySelector<HTMLElement>("[data-surface-choice] button");
    target?.focus();
    // Only on an opening, not on every change of tab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surfaces.focusKey]);
  // Import PDF steps aside on a cover (#287): its tab keeps the file, its body
  // says why until the author is back on an interior page.
  const unavailable = cover ? { pdf: PDF_COVER_DESCRIPTION } : undefined;
  // The strip's actions belong to the file; the assistant's New conversation
  // sits at its panel's foot instead.
  const actions: SurfaceAction[] =
    active?.kind === "pdf" && !cover ? pdfActions : [];

  return (
    <SidePanel
      id={PANEL_ID}
      open={open}
      title="Side panel"
      width={panel.width}
      min={panel.min}
      max={panel.max}
      onResize={panel.setWidth}
    >
      <div inert={pending} className="flex-none">
        <SurfaceStrip
          surfaces={surfaces.surfaces}
          activeId={active?.id ?? null}
          tabpanelId={TABPANEL_ID}
          actions={actions}
          unavailable={unavailable}
          onActivate={surfaces.activate}
          onCloseSurface={surfaces.closeSurface}
          onOpenSurface={surfaces.openSurface}
        />
      </div>
      {surfaces.surfaces.length === 0 && (
        <SurfaceChoice
          unavailable={unavailable}
          onOpen={surfaces.openSurface}
        />
      )}
      {surfaces.surfaces.map((surface) => {
        const isActive = surface.id === active?.id;
        return (
          <div
            key={surface.id}
            role={isActive ? "tabpanel" : undefined}
            id={isActive ? TABPANEL_ID : undefined}
            aria-labelledby={isActive ? tabId(surface.id) : undefined}
            hidden={!isActive}
            className="flex min-h-0 flex-1 flex-col"
          >
            {surface.kind === "assistant" ? (
              <AssistantPanel
                chat={chat}
                gate={gate}
                attachments={attachments}
                unplaced={unplaced}
                published={assistant.published}
                cover={cover}
                usage={usage.usage}
                target={assistant.target}
                context={assistant.context}
                historyTop={assistant.historyTop}
                focusKey={surfaces.focusKey}
                onUndo={() => {
                  assistant.undo();
                  chat.dismissRun();
                }}
                onRestart={
                  chat.messages.length > 0 && !assistant.published
                    ? chat.restart
                    : null
                }
              />
            ) : (
              <>
                {cover && (
                  <p
                    data-pdf-cover-note
                    className="text-muted flex flex-1 items-center justify-center px-8 text-center font-serif text-[17px] leading-snug"
                  >
                    {PDF_COVER_DESCRIPTION}
                  </p>
                )}
                <div hidden={cover} className="flex min-h-0 flex-1 flex-col">
                  <PdfImportPanel
                    pages={pages}
                    onAdd={onAdd}
                    onActions={setPdfActions}
                    dropRef={dropRef}
                  />
                </div>
              </>
            )}
          </div>
        );
      })}
    </SidePanel>
  );
}
