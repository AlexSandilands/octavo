"use client";

import type { IconName } from "@/components/icons";
import { ToolButton } from "../tool-button";

export type EditorTool = "pdf";

export const EDITOR_TOOLS: {
  id: EditorTool;
  label: string;
  icon: IconName;
}[] = [{ id: "pdf", label: "Import PDF", icon: "importFile" }];

// The slim strip on the editor's right edge that opens the side panel: one
// square per tool, pressed while its panel is out. The rail is the panel's
// permanent home so a new tool is one entry above, not a new header button.
export function ToolRail({
  active,
  panelId,
  onToggle,
  disabled = {},
}: {
  active: EditorTool | null;
  panelId: string;
  onToggle: (tool: EditorTool) => void;
  /** Tools that can't run right now, with the reason shown as the hint. */
  disabled?: Partial<Record<EditorTool, string>>;
}) {
  return (
    <nav
      aria-label="Editor panels"
      className="border-line bg-paper flex w-12 flex-none flex-col items-center gap-2 border-l py-3"
    >
      {EDITOR_TOOLS.map((tool) => (
        <ToolButton
          key={tool.id}
          icon={tool.icon}
          label={tool.label}
          hint={disabled[tool.id] ?? tool.label}
          iconClass="text-accent"
          pressed={active === tool.id}
          unavailable={Boolean(disabled[tool.id])}
          controls={panelId}
          onClick={() => onToggle(tool.id)}
        />
      ))}
    </nav>
  );
}
