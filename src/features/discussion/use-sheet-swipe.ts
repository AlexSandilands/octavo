"use client";

import { useRef } from "react";
import styles from "./discussion.module.css";

// Swipe down on the sheet's handle to dismiss it (issue #301) — never the only
// way out: the close button, Escape and Back all do the same. The panel
// follows the finger; past the threshold (or flicked) it closes, otherwise it
// eases back.
const DISMISS_PX = 110;
const FLICK_PX_PER_MS = 0.6;

export function useSheetSwipe(onDismiss: () => void) {
  const drag = useRef<{ y: number; t: number; panel: HTMLElement } | null>(
    null,
  );

  const offset = (e: React.PointerEvent) =>
    Math.max(0, e.clientY - (drag.current?.y ?? e.clientY));

  return {
    onPointerDown(e: React.PointerEvent<HTMLElement>) {
      const panel = e.currentTarget.closest<HTMLElement>("[role=dialog]");
      if (!panel) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      panel.classList.remove(styles.settling!);
      drag.current = { y: e.clientY, t: performance.now(), panel };
    },
    onPointerMove(e: React.PointerEvent<HTMLElement>) {
      if (!drag.current) return;
      drag.current.panel.style.transform = `translateY(${offset(e)}px)`;
    },
    onPointerUp(e: React.PointerEvent<HTMLElement>) {
      const d = drag.current;
      if (!d) return;
      const dy = offset(e);
      drag.current = null;
      const speed = dy / Math.max(1, performance.now() - d.t);
      if (dy > DISMISS_PX || (dy > 30 && speed > FLICK_PX_PER_MS)) {
        onDismiss();
        return;
      }
      d.panel.classList.add(styles.settling!);
      d.panel.style.transform = "";
    },
    onPointerCancel() {
      const d = drag.current;
      drag.current = null;
      if (d) d.panel.style.transform = "";
    },
  };
}
