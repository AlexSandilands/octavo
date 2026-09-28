"use client";

import { useRef, useState } from "react";
import type { Surface, SurfaceKind } from "./surfaces";

// The side panel's open surfaces (#353): a list of tabs, the active one, and
// whether the panel is out. Both survive closing the panel, so the author's
// tabs are as they left them when it comes back. One tab per kind for now; the
// list is shaped so a second conversation is an extra entry later.
// `focusKey` counts the openings that should take the focus — the panel
// sliding out, a surface chosen from the list or the + menu — and not a tab
// click or an arrow key, which keep the focus where it is.
export function useSurfaces() {
  const [surfaces, setSurfaces] = useState<Surface[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [focusKey, setFocusKey] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const active = surfaces.find((s) => s.id === activeId) ?? null;

  const openPanel = () => {
    setOpen(true);
    setFocusKey((k) => k + 1);
  };
  /** Close hands the focus back to the header button that opens the panel. */
  const closePanel = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const openSurface = (kind: SurfaceKind) => {
    const existing = surfaces.find((s) => s.kind === kind);
    if (existing) setActiveId(existing.id);
    else {
      const surface = { id: crypto.randomUUID(), kind };
      setSurfaces((list) => [...list, surface]);
      setActiveId(surface.id);
    }
    setOpen(true);
    setFocusKey((k) => k + 1);
  };
  const closeSurface = (id: string) => {
    const index = surfaces.findIndex((s) => s.id === id);
    if (index < 0) return;
    const rest = surfaces.filter((s) => s.id !== id);
    setSurfaces(rest);
    if (activeId === id)
      setActiveId((rest[index - 1] ?? rest[index] ?? null)?.id ?? null);
  };
  /** A surface that can't show here (Import PDF on a cover) lets another open
   *  tab take over; with none it stays, saying why. */
  const stepAside = (kind: SurfaceKind) => {
    if (active?.kind !== kind) return;
    const other = surfaces.find((s) => s.kind !== kind);
    if (other) setActiveId(other.id);
  };

  return {
    surfaces,
    active,
    open,
    focusKey,
    trigger,
    togglePanel: () => (open ? closePanel() : openPanel()),
    openPanel,
    closePanel,
    openSurface,
    closeSurface,
    activate: setActiveId,
    stepAside,
  };
}
