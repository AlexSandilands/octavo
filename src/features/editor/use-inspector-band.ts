"use client";
import { useSyncExternalStore } from "react";

/** A band that folds: whether it is open, and the press that flips it. */
export type InspectorBand = { open: boolean; onToggle: () => void };

const KEY = "octavo.editor.inspector-placement";
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
};
const readOpen = () => window.localStorage.getItem(KEY) !== "closed";

// Whether the inspector's pinned Placement band is unfolded. One state for
// every selected item, remembered per browser; open until it is folded away.
export function useInspectorPlacement(): InspectorBand {
  // Server-rendered open; the saved choice takes over on hydration.
  const open = useSyncExternalStore(subscribe, readOpen, () => true);
  const onToggle = () => {
    window.localStorage.setItem(KEY, open ? "closed" : "open");
    listeners.forEach((l) => l());
  };
  return { open, onToggle };
}
