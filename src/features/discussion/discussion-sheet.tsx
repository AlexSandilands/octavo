"use client";

import { useEffect } from "react";
import { DialogShell } from "@/components/dialog-shell";
import { DiscussionBody } from "./discussion-body";
import type { Discussion } from "./use-discussion";
import { useSheetSwipe } from "./use-sheet-swipe";
import { useVisualViewport } from "./use-visual-viewport";
import styles from "./discussion.module.css";

// The phone shell (issue #301): a bottom sheet over the reading column, about
// 85% of the screen, as a real dialog. Its box follows the visual viewport, so
// with the keyboard up it shrinks and the composer stays in view; the column
// behind is locked while it is open.
export function DiscussionSheet({ talk }: { talk: Discussion }) {
  const viewport = useVisualViewport();
  const swipe = useSheetSwipe(talk.hide);

  useEffect(() => {
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = before;
    };
  }, []);

  return (
    <DialogShell
      overlayClassName="fixed inset-x-0 z-50 flex flex-col justify-end bg-[rgba(32,32,28,0.4)]"
      overlayStyle={{ top: viewport.top, height: viewport.height }}
      panelClassName={`${styles.sheet} bg-card flex h-[85dvh] max-h-full w-full flex-col overflow-hidden rounded-t-[16px] pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_40px_rgba(0,0,0,0.25)]`}
      onClose={talk.hide}
    >
      {(titleId) => (
        <DiscussionBody
          talk={talk}
          titleId={titleId}
          grip={
            <div
              aria-hidden
              {...swipe}
              className="flex h-6 flex-none cursor-grab touch-none items-center justify-center"
            >
              <span className="bg-hair h-1.5 w-11 rounded-full" />
            </div>
          }
        />
      )}
    </DialogShell>
  );
}
