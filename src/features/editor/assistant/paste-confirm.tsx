"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui";
import { usdUp } from "@/lib/ai-usage-summary";
import { estimatePasteUsd } from "./paste-estimate";

// Asked before a long message goes (#312): laying a paste out costs more than
// a normal request, and pasting it onto the page by hand is free. Nothing is
// sent until Continue; Cancel hands the text back to the composer as it was.
export function PasteConfirm({
  chars,
  model,
  blocked,
  onContinue,
  onCancel,
}: {
  chars: number;
  /** The model the estimate is priced on; null until the usage has loaded. */
  model: string | null;
  /** Nothing can be sent just now: Continue waits. */
  blocked: boolean;
  onContinue: () => void;
  onCancel: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => box.current?.focus(), []);
  const usd = model ? estimatePasteUsd(chars, model) : null;
  const cost =
    usd === null ? "" : ` (about ${usdUp(usd)} on the current model)`;
  return (
    <div
      ref={box}
      tabIndex={-1}
      role="alertdialog"
      aria-labelledby="assistant-paste-confirm"
      data-assistant-paste-confirm
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.stopPropagation();
        onCancel();
      }}
      className="border-line bg-paper flex flex-col gap-3 rounded-xl border-[1.5px] px-3.5 py-3 outline-none"
    >
      <p
        id="assistant-paste-confirm"
        className="text-ink font-sans text-[15px] leading-snug"
      >
        That&rsquo;s a lot of content. Laying it out will cost more than a
        normal request{cost}. You could paste it onto the page yourself and use
        me to tidy it. Continue?
      </p>
      <div className="flex gap-2">
        <Button size="compact" disabled={blocked} onClick={onContinue}>
          Continue
        </Button>
        <Button size="compact" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
