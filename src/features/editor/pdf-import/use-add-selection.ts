"use client";

import { useEffect, useRef, useState } from "react";
import type { DropTarget } from "./drag-out";
import type { ReviewItem, SourceMapping } from "./model";
import type { UploadCache } from "./upload";

export type AddStatus = { text: string; tone: "info" | "warn" };
/** How long an outcome such as "Added 2 blocks" stays on screen. */
const OUTCOME_MS = 4000;

// One press of Add: hands the selection to the editor's insertion pipeline and
// reports back. Successful uploads are cached across retries so a failed batch
// never re-sends an image. `reset` (on close or replace) abandons the run.
export function useAddSelection(
  onAdd: (
    items: ReviewItem[],
    signal: AbortSignal,
    uploads: UploadCache,
    target?: DropTarget,
  ) => Promise<SourceMapping>,
) {
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState<AddStatus | null>(null);
  const uploads = useRef<UploadCache>(new Map());
  const controller = useRef<AbortController | null>(null);
  const lock = useRef(false);
  const generation = useRef(0);
  // Closing the panel abandons a running batch: nothing lands after unmount.
  useEffect(
    () => () => {
      generation.current++;
      controller.current?.abort();
    },
    [],
  );
  // Good news clears itself after a moment; a refusal stays until the author
  // acts on it, and progress stays for as long as the batch runs.
  useEffect(() => {
    if (!status || status.tone !== "info" || adding) return;
    const timer = setTimeout(() => setStatus(null), OUTCOME_MS);
    return () => clearTimeout(timer);
  }, [status, adding]);

  const add = async (
    items: ReviewItem[],
    onDone: (added: SourceMapping) => void,
    target?: DropTarget,
  ) => {
    if (lock.current || !items.length) return;
    lock.current = true;
    const gen = generation.current;
    const run = new AbortController();
    controller.current = run;
    setAdding(true);
    setStatus({
      text: "Fitting the content and uploading photos…",
      tone: "info",
    });
    try {
      const added = await onAdd(items, run.signal, uploads.current, target);
      if (gen !== generation.current) return;
      onDone(added);
      const n = Object.values(added).flat().length;
      setStatus({
        text: `Added ${n} ${n === 1 ? "block" : "blocks"} to the magazine.`,
        tone: "info",
      });
    } catch (error) {
      if (gen === generation.current)
        setStatus({
          text:
            error instanceof Error
              ? error.message
              : "Import failed. The issue is unchanged.",
          tone: "warn",
        });
    } finally {
      lock.current = false;
      if (gen === generation.current) setAdding(false);
    }
  };

  return {
    adding,
    status,
    add,
    cancel: () => controller.current?.abort(),
    reset: () => {
      generation.current++;
      controller.current?.abort();
      uploads.current = new Map();
      lock.current = false;
      setAdding(false);
      setStatus(null);
    },
  };
}
