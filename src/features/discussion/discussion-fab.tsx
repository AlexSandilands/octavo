"use client";

import { Icon } from "@/components/icons";
import { commentsLabel } from "./comments-label";

// The phone's way into the discussion (issue #301): a floating button at the
// bottom right, clear of the safe area, with the comment count.
export function DiscussionFab({
  count,
  onOpen,
}: {
  count: number | null;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={
        count === null ? "Discussion" : `Discussion, ${commentsLabel(count)}`
      }
      className="bg-accent text-paper hover:bg-accent-strong fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition-colors"
    >
      <Icon name="comment" size={24} strokeWidth={1.8} />
      {count !== null && count > 0 && (
        <span
          aria-hidden
          className="bg-paper text-accent absolute -top-1 -right-1 min-w-6 rounded-full px-1.5 text-center font-sans text-[12px] leading-6 font-semibold shadow"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
