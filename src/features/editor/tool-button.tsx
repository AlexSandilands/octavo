"use client";

import type { Ref } from "react";
import { Icon, type IconName } from "@/components/icons";

// The editor's 40px tool square (§6 allows a bordered icon square over the
// house Button): an icon that can grow a label, plus the aria-pressed and
// aria-keyshortcuts a tool bar owes. Shared by the canvas tool bar and the PDF
// import panel so the same block reads the same everywhere. The interaction
// contract is the house one: pointer cursor, hover wash, press, focus ring.
export function ToolButton({
  ref,
  icon,
  label,
  hint,
  shortcut,
  iconClass = "",
  showLabel = false,
  badge,
  pressed,
  expanded,
  disabled = false,
  unavailable = false,
  size = "md",
  controls,
  describedBy,
  onClick,
}: {
  ref?: Ref<HTMLButtonElement>;
  icon: IconName;
  label: string;
  hint?: string;
  shortcut?: string;
  iconClass?: string;
  /** The label beside the icon; `false` is the icon alone (the label stays the name). */
  showLabel?: boolean;
  /** A small count on the corner, for an icon-only button whose label carries it. */
  badge?: number;
  pressed?: boolean;
  /** For a button that unfolds a list or menu: whether it is open now. */
  expanded?: boolean;
  disabled?: boolean;
  /** Off, but still focusable — see `unavailable` in `ui.tsx`. */
  unavailable?: boolean;
  /** "sm" is a 36px square for dense rows (the import selection list); "xs" 32px. */
  size?: "md" | "sm" | "xs";
  /** The id of the region this tool shows or hides. */
  controls?: string;
  /** Supporting text that explains the control's current state. */
  describedBy?: string;
  onClick: () => void;
}) {
  const inert = disabled || unavailable;
  const look = inert
    ? "border-hair-warm text-ink cursor-default bg-white opacity-45"
    : pressed
      ? "border-accent bg-accent text-paper cursor-pointer motion-safe:active:scale-95"
      : "border-hair-warm text-ink hover:border-accent hover:bg-accent-wash cursor-pointer bg-white motion-safe:active:scale-95";
  const box =
    size === "xs" ? "h-8 w-8" : size === "sm" ? "h-9 w-9" : "h-10 w-10";
  const grow = showLabel ? "w-auto px-3.5" : "";
  return (
    <button
      ref={ref}
      type="button"
      onClick={inert ? undefined : onClick}
      disabled={disabled}
      aria-disabled={unavailable || undefined}
      title={hint ?? label}
      aria-label={label}
      aria-pressed={pressed}
      aria-expanded={expanded}
      aria-keyshortcuts={shortcut}
      aria-controls={controls}
      aria-describedby={describedBy}
      className={`relative flex flex-none items-center justify-center gap-1.5 rounded-[9px] border font-sans text-[13px] font-semibold transition-[transform,background-color,border-color,color] duration-150 ease-out select-none ${box} ${grow} ${look}`}
    >
      <Icon
        name={icon}
        size={size === "xs" ? 14 : 16}
        className={pressed ? "" : iconClass}
      />
      {showLabel && <span>{label}</span>}
      {badge !== undefined && (
        <span
          aria-hidden="true"
          className={`absolute -top-1.5 -right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 font-sans text-[10px] leading-none font-bold tabular-nums ${
            pressed ? "bg-paper text-accent" : "bg-accent text-paper"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
