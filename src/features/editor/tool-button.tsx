"use client";

import { Icon, type IconName } from "@/components/icons";

// The editor's 40px tool square (§6 allows a bordered icon square over the
// house Button): an icon that can grow a label, plus the aria-pressed and
// aria-keyshortcuts a tool bar owes. Shared by the canvas tool bar and the PDF
// import panel so the same block reads the same everywhere. The interaction
// contract is the house one: pointer cursor, hover wash, press, focus ring.
export function ToolButton({
  icon,
  label,
  hint,
  shortcut,
  iconClass = "",
  showLabel = false,
  pressed,
  disabled = false,
  unavailable = false,
  size = "md",
  controls,
  onClick,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  shortcut?: string;
  iconClass?: string;
  /** Label beside the icon: from `xl` up, or always. `false` is icon only. */
  showLabel?: boolean | "always";
  pressed?: boolean;
  disabled?: boolean;
  /** Off, but still focusable — see `unavailable` in `ui.tsx`. */
  unavailable?: boolean;
  /** "sm" is a 36px square for dense rows (the import selection list). */
  size?: "md" | "sm";
  /** The id of the region this tool shows or hides. */
  controls?: string;
  onClick: () => void;
}) {
  const inert = disabled || unavailable;
  const look = inert
    ? "border-hair-warm text-ink cursor-default bg-white opacity-45"
    : pressed
      ? "border-accent bg-accent text-paper cursor-pointer motion-safe:active:scale-95"
      : "border-hair-warm text-ink hover:border-accent hover:bg-accent-wash cursor-pointer bg-white motion-safe:active:scale-95";
  const box = size === "sm" ? "h-9 w-9" : "h-10 w-10";
  const grow =
    showLabel === "always"
      ? "w-auto px-3"
      : showLabel
        ? "xl:w-auto xl:px-3.5"
        : "";
  return (
    <button
      type="button"
      onClick={inert ? undefined : onClick}
      disabled={disabled}
      aria-disabled={unavailable || undefined}
      title={hint ?? label}
      aria-label={label}
      aria-pressed={pressed}
      aria-keyshortcuts={shortcut}
      aria-controls={controls}
      className={`flex flex-none items-center justify-center gap-1.5 rounded-[9px] border font-sans text-[13px] font-semibold transition-[transform,background-color,border-color,color] duration-150 ease-out select-none ${box} ${grow} ${look}`}
    >
      <Icon name={icon} size={16} className={pressed ? "" : iconClass} />
      {showLabel && (
        <span className={showLabel === "always" ? "" : "hidden xl:inline"}>
          {label}
        </span>
      )}
    </button>
  );
}
