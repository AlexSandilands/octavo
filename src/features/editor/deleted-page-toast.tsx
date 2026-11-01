"use client";

import { useEffect, useRef } from "react";

const VISIBLE_MS = 8000;

// Says a page was deleted and offers the existing history undo. It dismisses
// itself after a while, or as soon as any other edit moves the history on, so
// Undo can only ever restore the page it names.
export function DeletedPageToast({
  number,
  top,
  onUndo,
  onDismiss,
}: {
  number: number;
  top: unknown;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  const startTop = useRef(top);
  useEffect(() => {
    if (top !== startTop.current) onDismiss();
  }, [top, onDismiss]);
  useEffect(() => {
    const t = setTimeout(onDismiss, VISIBLE_MS);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      role="status"
      className="bg-ink text-paper absolute bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full py-1.5 pr-1.5 pl-4 font-sans text-sm shadow-lg"
    >
      <span>Page {number} deleted</span>
      <button
        onClick={() => {
          onUndo();
          onDismiss();
        }}
        className="text-paper min-h-11 rounded-full px-4 font-semibold underline"
      >
        Undo
      </button>
    </div>
  );
}
