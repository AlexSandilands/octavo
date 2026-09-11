"use client";

import type { IconName } from "@/components/icons";
import { ToolButton } from "../tool-button";

export type EditorTool = "pdf";

export const EDITOR_TOOLS: {
  id: EditorTool;
  label: string;
  icon: IconName;
}[] = [{ id: "pdf", label: "Import PDF", icon: "importFile" }];

/** A smaller button hung under the open tool's own: Close, Replace PDF, … */
export type RailAction = {
  id: string;
  icon: IconName;
  label: string;
  hint?: string;
  disabled?: boolean;
  onClick: () => void;
};

// The slim strip on the editor's right edge that opens the side panel: one
// square per tool, pressed while its panel is out. The rail is the panel's
// permanent home so a new tool is one entry above, not a new header button.
// The open tool's actions slide down out of its button, so the panel itself
// carries no chrome.
export function ToolRail({
  active,
  panelId,
  actions,
  onToggle,
}: {
  active: EditorTool | null;
  panelId: string;
  actions: RailAction[];
  onToggle: (tool: EditorTool) => void;
}) {
  return (
    <nav
      aria-label="Editor panels"
      className="border-line bg-paper flex w-[53px] flex-none flex-col items-center gap-2 border-l py-3"
    >
      {EDITOR_TOOLS.map((tool) => (
        <div key={tool.id} className="flex flex-col items-center gap-2">
          <ToolButton
            icon={tool.icon}
            label={tool.label}
            iconClass="text-accent"
            pressed={active === tool.id}
            controls={panelId}
            onClick={() => onToggle(tool.id)}
          />
          {active === tool.id &&
            actions.map((action) => (
              <div
                key={action.id}
                className="starting:-translate-y-4 starting:opacity-0 motion-safe:transition-[translate,opacity] motion-safe:duration-300 motion-safe:ease-out"
              >
                <ToolButton
                  icon={action.icon}
                  label={action.label}
                  hint={action.hint}
                  size="sm"
                  disabled={action.disabled}
                  onClick={action.onClick}
                />
              </div>
            ))}
        </div>
      ))}
    </nav>
  );
}
