"use client";
import {
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from "react";

export type Dock = "left" | "right";
const KEY = "octavo.editor.inspector-dock";
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
  const dock = useSyncExternalStore(subscribe, readDock, () => "right");
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  // Set by a drag so the click that ends it doesn't flip the side a second time.
  const dragged = useRef(false);
  const setDock = (next: Dock) => {
    window.localStorage.setItem(KEY, next);
    listeners.forEach((l) => l());
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
  return { dock, setDock, drag, onHandlePointerDown, onHandleClick };
}
