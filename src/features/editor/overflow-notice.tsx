"use client";

// The marker on a block that runs past its page (issue #93): a dashed rule drawn
// exactly where the page's text area ends — so the author can see what is about
// to be cut and what will move — with the one-action fix hanging off it.
//
// It appears the moment a block overflows, including the moment a paste causes
// it, and disappears once the block fits. The split itself is never silent: the
// author presses this button, or nothing happens.
export function OverflowNotice({
  top,
  note,
  onFlow,
}: {
  /** Where the page ends, in the block's own coordinates. */
  top: number;
  note: string;
  /** Absent when this block can't be flowed (a lone oversized node, or not text). */
  onFlow?: () => void;
}) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-20"
      style={{ top }}
    >
      <div className="border-warn border-t border-dashed" />
      <div className="flex justify-end">
        <div
          role="status"
          className="bg-warn text-paper pointer-events-auto flex items-center gap-2 rounded-b px-2 py-0.5 shadow-[0_4px_14px_rgba(40,36,28,0.16)]"
        >
          <span className="font-sans text-[9px] font-semibold tracking-[0.1em] uppercase">
            {note}
          </span>
          {onFlow && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFlow();
              }}
              className="bg-paper text-warn hover:bg-page focus-visible:outline-paper my-0.5 rounded-[4px] px-2 py-1 font-sans text-[10px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Flow onto next page
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
