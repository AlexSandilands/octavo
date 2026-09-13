"use client";
import {
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { PAGE_W } from "@/features/blocks/page-frame";

export type Dock = "left" | "right";
/** Width of the inspector's column (panel plus its gutters), which the stage pads out. */
export const INSPECTOR_RESERVE = 344;
const KEY = "octavo.editor.inspector-dock";

/** Breathing room kept between the page's edge and the inspector. */
const DODGE_GAP = 24;

/** How far the page must slide away from the inspector so the two never meet:
 *  0 when the fitted page already clears it, otherwise just the overlap, capped
 *  so the page never leaves the stage's padding (`padX`) on the far side. */
export function stageDodge(
  width: number,
  padX: number,
  scale: number,
  active: boolean,
) {
  if (!active || !width) return 0;
  // The page is centred in the stage; the panel's inner edge sits one gutter
  // (12px) inside its column on the docked side.
  const pageWidth = PAGE_W * scale;
  const pageEdge = width / 2 + pageWidth / 2;
  const panelEdge = width - INSPECTOR_RESERVE + 12;
  const limit = Math.max(0, (width - padX - pageWidth) / 2);
  return Math.min(
    limit,
    Math.max(0, Math.round(pageEdge + DODGE_GAP - panelEdge)),
  );
}
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
};
const readDock = (): Dock =>
  window.localStorage.getItem(KEY) === "left" ? "left" : "right";

// Which side of the page the inspector sits on. Dragging its handle carries
// the panel with the pointer; letting go docks it to whichever side of the
// stage row the pointer is over. Remembered per browser.
export function usePanelDock() {
  // Server-rendered on the right; the saved side takes over on hydration.
  const dock = useSyncExternalStore<Dock>(subscribe, readDock, () => "right");
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  // Whether the panel has changed sides this session: only then does the page
  // glide to its new place; on load it simply sits where it belongs.
  const [moved, setMoved] = useState(false);
  // Set by a drag so the click that ends it doesn't flip the side a second time.
  const dragged = useRef(false);
  const setDock = (next: Dock) => {
    window.localStorage.setItem(KEY, next);
    listeners.forEach((l) => l());
    setMoved(true);
  };
  const onHandlePointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    const handle = e.currentTarget;
    const row = handle.closest<HTMLElement>("[data-editor-stage-row]");
    const start = { x: e.clientX, y: e.clientY };
    handle.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) =>
      setDrag({ x: ev.clientX - start.x, y: ev.clientY - start.y });
    const up = (ev: PointerEvent) => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
      setDrag(null);
      const rect = row?.getBoundingClientRect();
      const mid = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
      dragged.current = Math.abs(ev.clientX - start.x) > 4;
      if (dragged.current) setDock(ev.clientX < mid ? "left" : "right");
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  };
  // A plain press (no drag) flips sides too, for the keyboard and for taps.
  const onHandleClick = () => {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    setDock(dock === "left" ? "right" : "left");
  };
  return { dock, setDock, drag, moved, onHandlePointerDown, onHandleClick };
}
