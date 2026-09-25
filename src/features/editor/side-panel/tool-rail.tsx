"use client";

import type { RefObject } from "react";
import type { IconName } from "@/components/icons";
import { assistantEnabled } from "../assistant/enabled";
import { ToolButton } from "../tool-button";

export type EditorTool = "pdf" | "assistant";

// The assistant is dormant until a deployment sets NEXT_PUBLIC_AI_ASSISTANT (#306).
export const EDITOR_TOOLS: {
  id: EditorTool;
  label: string;
  icon: IconName;
}[] = [
  { id: "pdf", label: "Import PDF", icon: "importFile" },
  ...(assistantEnabled
    ? [
        {
          id: "assistant" as const,
          label: "Assistant",
          icon: "sparkle" as const,
        },
      ]
    : []),
];

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
  unavailable,
  buttons,
  onToggle,
}: {
  active: EditorTool | null;
  panelId: string;
  actions: RailAction[];
  unavailable?: Partial<Record<EditorTool, string>>;
  /** Each tool's button, so closing a panel can hand focus back to it. */
  buttons?: RefObject<Partial<Record<EditorTool, HTMLButtonElement | null>>>;
  onToggle: (tool: EditorTool) => void;
}) {
  return (
    <nav
      aria-label="Editor panels"
      className="border-line bg-paper flex w-[53px] flex-none flex-col items-center gap-2 border-l py-3"
    >
      {EDITOR_TOOLS.map((tool) => {
        const unavailableReason = unavailable?.[tool.id];
        const descriptionId = `editor-tool-${tool.id}-description`;
        return (
          <div
            key={tool.id}
            className="group relative flex flex-col items-center gap-2"
          >
            <ToolButton
              ref={(el) => {
                if (buttons) buttons.current[tool.id] = el;
              }}
              icon={tool.icon}
              label={tool.label}
              iconClass="text-accent"
              pressed={active === tool.id}
              controls={panelId}
              unavailable={Boolean(unavailableReason)}
              describedBy={unavailableReason ? descriptionId : undefined}
              onClick={() => onToggle(tool.id)}
            />
            {unavailableReason && (
              <span
                id={descriptionId}
                role="tooltip"
                className="bg-ink text-paper pointer-events-none absolute top-1/2 right-full z-50 mr-2 w-52 -translate-y-1/2 rounded-md px-3 py-2 text-left font-sans text-xs leading-snug font-medium opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
              >
                {unavailableReason}
              </span>
            )}
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
        );
      })}
    </nav>
  );
}
