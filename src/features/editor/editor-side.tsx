"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type RefObject,
} from "react";
import dynamic from "next/dynamic";
import type { Page } from "@/lib/blocks";
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
import { SidePanel } from "./side-panel/side-panel";
import {
  ToolRail,
  type EditorTool,
  type RailAction,
} from "./side-panel/tool-rail";
import type { usePanelWidth } from "./side-panel/use-panel-width";
import type { DropHandler } from "./use-pdf-drag-out";

// The importer and its parser load only when the tool is opened.
const PdfImportPanel = dynamic(() => import("./pdf-import/panel"), {
  ssr: false,
});
const PANEL_ID = "editor-side-panel";
const ASSISTANT_INPUT_ID = "assistant-input";
const PDF_COVER_DESCRIPTION =
  "PDF import is available on interior pages. Move to another page to use it.";
const TITLES: Record<EditorTool, string> = {
  pdf: "Import PDF",
  assistant: "Assistant",
};

// The editor's right-hand side: the sliding panel and the rail that opens it.
// The open tool hangs its actions under its rail button (the PDF panel reports
// its Replace once a file is open); Close is the rail's own, under every tool.
// The assistant's conversation lives here rather than in its panel, so closing
// the panel doesn't end it.
export function EditorSide({
  tool,
  onToggle,
  onClose,
  pending,
  cover,
  panel,
  pages,
  onAdd,
  dropRef,
  assistant,
}: {
  tool: EditorTool | null;
  onToggle: (tool: EditorTool) => void;
  onClose: () => void;
  /** An import is landing: the rail sits out until it has. */
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
    /** The editor's own Undo: a run is one step. */
    undo: () => void;
    historyTop: EditorSnapshot | null;
    /** Set here: the Ask box on a block sends through this conversation. */
    askRef: RefObject<AskHandler | null>;
  };
}) {
  const [toolActions, setToolActions] = useState<RailAction[]>([]);
  const buttons = useRef<Partial<Record<EditorTool, HTMLButtonElement | null>>>(
    {},
  );
  const usage = useAssistantUsage(
    assistantEnabled && !assistant.published,
    tool === "assistant",
  );
  const chat = useAssistantChat({
    issueId: assistant.issueId,
    snapshot: assistant.snapshot,
    tools: assistant.tools,
    onRunEnd: () => void usage.refresh(),
  });
  // Import PDF steps aside on a cover (#287); the assistant stays.
  const shown = tool === "pdf" && cover ? null : tool;
  // An Ask opens the panel on the run (or on why it can't take one); an open
  // panel takes the focus, as it does on opening, with Stop at hand.
  const { askRef } = assistant;
  useEffect(() => {
    askRef.current = async (blockId, text) => {
      if (shown === "assistant")
        document.getElementById(ASSISTANT_INPUT_ID)?.focus();
      else onToggle("assistant");
      // The editor fetches the figure on opening; if it hasn't landed, ask.
      const now = usage.usage ?? (await usage.refresh());
      if (budgetSpent(chat, now)) return { ok: false, reason: "spent" };
      return chat.send(
        askMessage({ page: assistant.target.page, blockId }, text),
      );
    };
  });
  // A closing panel keeps its content while it slides out. Each opening counts,
  // so a panel reopened mid-slide still mounts afresh and takes the focus.
  const [last, setLast] = useState<EditorTool>(shown ?? "pdf");
  const [opened, setOpened] = useState({ shown, count: 0 });
  if (shown !== opened.shown)
    setOpened({ shown, count: opened.count + (shown ? 1 : 0) });
  if (shown && shown !== last) setLast(shown);
  const content = shown ?? last;
  // Closing hands focus back to the tool's own rail button.
  const close = () => {
    const button = tool ? buttons.current[tool] : null;
    onClose();
    button?.focus();
  };
  const assistantActions: RailAction[] =
    shown === "assistant" && chat.messages.length > 0 && !assistant.published
      ? [
          {
            id: "restart",
            icon: "refresh",
            label: "New conversation",
            disabled: chat.busy,
            onClick: chat.restart,
          },
        ]
      : [];

  return (
    <>
      <SidePanel
        id={PANEL_ID}
        open={shown !== null}
        title={TITLES[content]}
        width={panel.width}
        min={panel.min}
        max={panel.max}
        onResize={panel.setWidth}
      >
        {content === "assistant" ? (
          <AssistantPanel
            key={opened.count}
            chat={chat}
            published={assistant.published}
            cover={cover}
            usage={usage.usage}
            target={assistant.target}
            historyTop={assistant.historyTop}
            onUndo={() => {
              assistant.undo();
              chat.dismissRun();
            }}
          />
        ) : (
          <PdfImportPanel
            pages={pages}
            onAdd={onAdd}
            onRailActions={setToolActions}
            dropRef={dropRef}
          />
        )}
      </SidePanel>
      <div inert={pending} className="flex">
        <ToolRail
          active={shown}
          panelId={PANEL_ID}
          buttons={buttons}
          actions={shown === "pdf" ? toolActions : assistantActions}
          unavailable={cover ? { pdf: PDF_COVER_DESCRIPTION } : undefined}
          onToggle={onToggle}
          onClose={close}
        />
      </div>
    </>
  );
}
