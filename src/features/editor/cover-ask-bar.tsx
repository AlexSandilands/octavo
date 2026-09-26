"use client";
import { useRef } from "react";
import { AskControl } from "./assistant/ask-box";
import type { SendResult } from "./assistant/use-assistant-chat";
import { useCoverToolbarBounds } from "./use-cover-toolbar-bounds";

/** Chrome shared by the cover's bars above a selected item. */
export const COVER_BAR =
  "border-hair chrome-unscaled absolute bottom-full left-0 z-30 mb-2 flex w-max rounded-[8px] border bg-white p-1.5 shadow-[0_4px_14px_rgba(40,36,28,0.16)]";

// A cover item with no words to format (a logo, a photo) still gets the
// assistant's Ask (#313), in a small bar of its own where a format bar would be.
export function CoverAskBar({
  onAsk,
}: {
  onAsk: (text: string) => Promise<SendResult>;
}) {
  const root = useRef<HTMLDivElement>(null);
  useCoverToolbarBounds(root, true);
  return (
    <div
      ref={root}
      data-canvas-chrome
      data-block-bar
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className={`${COVER_BAR} items-center`}
    >
      <AskControl onSend={onAsk} divider={false} />
    </div>
  );
}
