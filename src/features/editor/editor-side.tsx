"use client";

import { useState, type ComponentProps, type RefObject } from "react";
import dynamic from "next/dynamic";
import type { Page } from "@/lib/blocks";
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

// The editor's right-hand side: the sliding panel and the rail that opens it.
// The open tool hangs its actions under its rail button (the PDF panel reports
// its Replace once a file is open); Close is the rail's own.
export function EditorSide({
  tool,
  onToggle,
  onClose,
  pending,
  panel,
  pages,
  onAdd,
  dropRef,
}: {
  tool: EditorTool | null;
  onToggle: (tool: EditorTool) => void;
  onClose: () => void;
  /** An import is landing: the rail sits out until it has. */
  pending: boolean;
  panel: ReturnType<typeof usePanelWidth>;
  pages: Page[];
  onAdd: ComponentProps<typeof PdfImportPanel>["onAdd"];
  dropRef: RefObject<DropHandler | null>;
}) {
  const [toolActions, setToolActions] = useState<RailAction[]>([]);
  return (
    <>
      <SidePanel
        id={PANEL_ID}
        open={tool === "pdf"}
        title="Import PDF"
        width={panel.width}
        min={panel.min}
        max={panel.max}
        onResize={panel.setWidth}
      >
        <PdfImportPanel
          pages={pages}
          onAdd={onAdd}
          onRailActions={setToolActions}
          dropRef={dropRef}
        />
      </SidePanel>
      <div inert={pending} className="flex">
        <ToolRail
          active={tool}
          panelId={PANEL_ID}
          actions={
            tool
              ? [
                  {
                    id: "close",
                    icon: "close",
                    label: "Close panel",
                    onClick: onClose,
                  },
                  ...toolActions,
                ]
              : []
          }
          onToggle={onToggle}
        />
      </div>
    </>
  );
}
