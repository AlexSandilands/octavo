import type { ReactNode } from "react";

// The segmented control the block toolbars share: a small-caps label, then a
// ruled row of options of which one is pressed (ink on white — the Broadsheet
// says a chosen thing in black, keeping the red for actions). Every segment
// carries its word; an icon may sit beside it. Sized for the chrome scale
// (1.1× on screen), so h-8 reads as a 35px control.
export function SegmentGroup({
  label,
  ariaLabel,
  children,
}: {
  label: string;
  /** Names the group for assistive tech when the visible label isn't enough. */
  ariaLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-grey-soft font-ui text-[11px] font-semibold tracking-[0.12em] uppercase">
        {label}
      </span>
      <div
        role={ariaLabel ? "group" : undefined}
        aria-label={ariaLabel}
        className="border-hairline-strong divide-hairline-strong flex divide-x overflow-hidden rounded-ui border"
      >
        {children}
      </div>
    </div>
  );
}

export function Segment({
  active,
  title,
  onClick,
  children,
}: {
  active: boolean;
  /** Tooltip and accessible name, when the visible word is shortened. */
  title?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex h-8 min-w-8 cursor-pointer items-center justify-center gap-1 px-2 font-ui text-[12px] font-semibold whitespace-nowrap transition-colors ${
        active
          ? "bg-lead text-sheet"
          : "text-lead hover:bg-newsprint bg-sheet"
      }`}
    >
      {children}
    </button>
  );
}
