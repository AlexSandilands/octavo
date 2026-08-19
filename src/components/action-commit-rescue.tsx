"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Workaround for a scheduling bug in the React canary that Next 15.5 vendors:
// the re-render applying a server action's revalidation can suspend on flight
// data that resolves mid-render, lose its wake-up, and leave the old UI on
// screen with the transition stuck pending. Any plain state update clears the
// stall (React drops its suspended-lane bookkeeping and retries), so after a
// mutation this component ticks one every 150ms until the next server render
// commits — observed as a fresh `stamp` — or a deadline passes. Remove once
// Next ships the fixed React (16.2+); `docs/workflow.md` has the full story.

let arm: (() => void) | null = null;

/** Call after awaiting a mutating server action. No-op if no rescuer is mounted. */
export function nudgeActionCommit() {
  arm?.();
}

export function ActionCommitRescue({ stamp }: { stamp: number }) {
  const [, tick] = useState(0);
  const deadline = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timer.current !== null) clearInterval(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => {
    arm = () => {
      deadline.current = Date.now() + 12_000;
      if (timer.current === null) {
        timer.current = setInterval(() => {
          if (Date.now() > deadline.current) stop();
          else tick((n) => n + 1);
        }, 150);
      }
    };
    return () => {
      arm = null;
      stop();
    };
  }, [stop]);

  // A fresh server render reached the screen, so the stall (if any) is over.
  useEffect(() => stop(), [stamp, stop]);

  return null;
}
