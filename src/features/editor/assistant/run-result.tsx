"use client";

import { Icon } from "@/components/icons";
import { unplacedText } from "./attached";
import type { RunSummary } from "./executor";

// What the last run did, with its one-step Undo while that is still the step
// Ctrl+Z would take; or, when the circuit-breaker stopped it, why.
export function RunResult({
  summary,
  stuck,
  unplaced,
  onUndo,
}: {
  summary: RunSummary | null;
  stuck: string | null;
  /** Attached photos the run left unplaced (#343). */
  unplaced: number;
  onUndo: () => void;
}) {
  if (!summary && !stuck && !unplaced) return null;
  return (
    <div
      data-assistant-run
      className="border-line flex flex-col gap-2.5 rounded-lg border bg-white px-3.5 py-3 font-sans text-[15px] leading-snug"
    >
      {stuck && <p className="text-warn font-medium">{stuck}</p>}
      {summary && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <p className="text-ink">{summary.text}</p>
          <button
            type="button"
            onClick={onUndo}
            className="border-hair-warm text-ink hover:border-accent hover:bg-accent-wash inline-flex h-11 flex-none cursor-pointer items-center gap-2 rounded-lg border-[1.5px] bg-white px-4 font-sans text-[15px] font-semibold transition-colors motion-safe:active:scale-95"
          >
            <Icon name="undo" size={17} />
            Undo
          </button>
        </div>
      )}
      {unplaced > 0 && <p className="text-ink">{unplacedText(unplaced)}</p>}
    </div>
  );
}
