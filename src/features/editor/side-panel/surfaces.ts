import type { IconName } from "@/components/icons";
import { assistantEnabled } from "../assistant/enabled";

/** The side panel's DOM id: the header button controls it. */
export const PANEL_ID = "editor-side-panel";

/** What the side panel can show: one tab per open surface (#353). */
export type SurfaceKind = "pdf" | "assistant";
export type Surface = { id: string; kind: SurfaceKind };

// The assistant is dormant until a deployment sets NEXT_PUBLIC_AI_ASSISTANT (#306).
export const SURFACES: { kind: SurfaceKind; label: string; icon: IconName }[] =
  [
    ...(assistantEnabled
      ? [
          {
            kind: "assistant" as const,
            label: "Assistant",
            icon: "sparkle" as const,
          },
        ]
      : []),
    { kind: "pdf", label: "Import PDF", icon: "importFile" },
  ];

export const surfaceLabel = (kind: SurfaceKind) =>
  SURFACES.find((s) => s.kind === kind)?.label ?? kind;

/** A small control the active surface hangs in the strip: Replace PDF, New conversation. */
export type SurfaceAction = {
  id: string;
  icon: IconName;
  label: string;
  hint?: string;
  disabled?: boolean;
  onClick: () => void;
};
