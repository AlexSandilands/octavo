"use client";

import { blockKind } from "../block-kinds";
import { ToolButton } from "../tool-button";
import type { ImportKind } from "./model";

// Which block a selected region becomes. Text can be a heading or body text;
// a photo is only ever an image, shown pressed so the row still says what it is.
export function KindToggle({
  kind,
  image,
  onChange,
  size = "md",
  showLabel = false,
}: {
  kind: ImportKind;
  image: boolean;
  onChange: (kind: ImportKind) => void;
  size?: "md" | "sm";
  showLabel?: boolean | "always";
}) {
  if (image) {
    const k = blockKind("image");
    return (
      <ToolButton
        icon={k.icon}
        label={k.label}
        hint="Added as a photo"
        pressed
        size={size}
        showLabel={showLabel}
        onClick={() => {}}
      />
    );
  }
  return (
    <div role="group" aria-label="Add as" className="flex gap-1">
      {(["heading", "text"] as const).map((type) => {
        const k = blockKind(type);
        return (
          <ToolButton
            key={type}
            icon={k.icon}
            label={k.label}
            hint={`Add as ${k.label.toLowerCase()}`}
            pressed={kind === type}
            size={size}
            showLabel={showLabel}
            onClick={() => onChange(type)}
          />
        );
      })}
    </div>
  );
}
