"use client";

import { Icon } from "@/components/icons";

// The way into the discussion on both readers (issue #301): a 56px green disc
// with a speech bubble. On a phone it floats at the bottom right, clear of the
// safe area; on a computer it sits in the reader's top-right corner. No count
// on it — a number on a bubble reads as "unread".
export function DiscussionButton({
  floating,
  onOpen,
}: {
  floating: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Discussion"
      title="Discussion"
      data-discussion-button
      className={`bg-accent text-paper hover:bg-accent-strong flex h-14 w-14 flex-none cursor-pointer items-center justify-center rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition-colors ${
        floating
          ? "fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30"
          : ""
      }`}
    >
      <Icon name="comment" size={24} strokeWidth={1.8} />
    </button>
  );
}
