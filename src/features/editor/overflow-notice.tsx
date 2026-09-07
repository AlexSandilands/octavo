"use client";

// The marker on a block that runs past its page (issue #93): a dashed rule drawn
// exactly where the page's text area ends — so the author can see what is about
// to be cut and what will move — with the one-action fix hanging off it.
//
// It appears the moment a block overflows, including the moment a paste causes
// it, and disappears once the block fits. The fix itself is never silent: the
// author presses this button, or nothing happens.
export function OverflowNotice({
  top,
  note,
  action,
}: {
  /** Where the page ends, in the block's own coordinates. */
  top: number;
  note: string;
  /** Absent when the block is simply taller than a page — nothing would help. */
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-20"
      style={{ top }}
    >
      <div className="border-red border-t border-dashed" />
      <div className="flex justify-end">
        <div
          role="status"
          className="bg-red text-sheet pointer-events-auto flex items-center gap-2 px-2 py-0.5"
        >
          <span className="font-ui text-[11px] font-semibold tracking-[0.12em] uppercase">
            {note}
          </span>
          {action && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                action.onClick();
              }}
              className="bg-sheet text-red hover:bg-newsprint focus-visible:outline-sheet my-0.5 cursor-pointer rounded-ui px-2 py-1 font-ui text-[11px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {action.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
