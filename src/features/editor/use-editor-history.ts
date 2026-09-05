"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { Page } from "@/lib/blocks";

// Undo/redo for the editor's *document* — pages, blocks and where the author was
// in them (issue #222). Text typed inside a block has its own, finer history:
// Tiptap's while a body block has focus, the browser's inside the in-place
// editables and the plain inputs. This layer never fights those (see
// useUndoShortcuts); it snapshots what they produce so a whole typing run is one
// step once focus leaves.
//
// Snapshots are the whole `pages` array. It is immutably updated everywhere, so
// a snapshot is a handful of pointers, and an issue is small enough that the cap
// below is generous rather than a compromise.

/** A restorable editor state: the document plus the author's place in it. */
export type EditorSnapshot = {
  pages: Page[];
  curPage: number;
  sel: string | null;
};

const CAP = 100;
/** Edits to the same field closer together than this fold into one step. */
const COALESCE_MS = 700;

export function useEditorHistory() {
  // The stacks are read *and* written inside one handler (undo pops one and
  // pushes onto the other), which functional state updates can't express — so
  // they live in refs and only the two booleans the buttons need are state.
  const past = useRef<EditorSnapshot[]>([]);
  const future = useRef<EditorSnapshot[]>([]);
  const stream = useRef<{ name: string; at: number } | null>(null);
  const [ends, setEnds] = useState({ canUndo: false, canRedo: false });
  const [notice, setNotice] = useState("");

  const sync = () =>
    setEnds({
      canUndo: past.current.length > 0,
      canRedo: future.current.length > 0,
    });

  /**
   * Take a step, called with the state *before* the edit lands. `name` marks a
   * run of edits to one field (typing, a size nudge held down, a drag): a repeat
   * within the window keeps the step the run started from instead of adding one.
   */
  const record = (snapshot: EditorSnapshot, name?: string) => {
    const now = Date.now();
    const last = stream.current;
    stream.current = name ? { name, at: now } : null;
    if (name && last?.name === name && now - last.at < COALESCE_MS) return;
    past.current = [...past.current.slice(1 - CAP), snapshot];
    future.current = [];
    setNotice("");
    sync();
  };

  const step = (
    from: typeof past,
    to: typeof future,
    current: EditorSnapshot,
    empty: string,
  ) => {
    const next = from.current.at(-1);
    if (!next) {
      setNotice(empty);
      return null;
    }
    from.current = from.current.slice(0, -1);
    to.current = [...to.current, current];
    // A restore ends any run in progress, so the next edit always starts a step.
    stream.current = null;
    setNotice("");
    sync();
    return next;
  };

  return {
    ...ends,
    /** Announced politely when there is nothing left to undo or redo. */
    notice,
    record,
    undo: (current: EditorSnapshot) =>
      step(past, future, current, "Nothing to undo"),
    redo: (current: EditorSnapshot) =>
      step(future, past, current, "Nothing to redo"),
  };
}

/** Block ids whose content differs between two documents — the uncontrolled
 *  in-place editors holding them have to be re-seeded (see `reseed`). */
export function changedBlockIds(before: Page[], after: Page[]): string[] {
  const seen = new Map<string, string>();
  for (const p of before) {
    for (const b of p.blocks) seen.set(b.id, JSON.stringify(b));
  }
  const ids: string[] = [];
  for (const p of after) {
    for (const b of p.blocks) {
      const was = seen.get(b.id);
      if (was !== undefined && was !== JSON.stringify(b)) ids.push(b.id);
    }
  }
  return ids;
}

// Editor-level Ctrl/Cmd+Z · Shift+Z · Y. Deliberately silent while focus is in
// any text entry: Tiptap, the in-place editables and the inputs all have their
// own undo there, and stealing the keystroke would break it. A dialog on top
// owns the keyboard too.
export function useUndoShortcuts({
  undo,
  redo,
}: {
  undo: () => void;
  redo: () => void;
}) {
  const onUndo = useEffectEvent(undo);
  const onRedo = useEffectEvent(redo);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      const el = document.activeElement;
      const typing =
        el instanceof HTMLElement &&
        (el.isContentEditable ||
          el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement);
      if (typing || document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      if (key === "y" || e.shiftKey) onRedo();
      else onUndo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
