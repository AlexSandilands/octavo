"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import {
  dealHints,
  HINTS_SHOWN,
  moreThanShown,
  pinnedHint,
  stillOffered,
  type Deck,
  type HintContext,
} from "./hints";
import { PRESETS, type PresetId } from "./presets";

const PILL =
  "border-hair-warm text-ink inline-flex h-9 items-center gap-1.5 rounded-full border bg-white px-3 font-sans text-[13px] font-semibold";
const label = (id: PresetId) => PRESETS.find((p) => p.id === id)!.label;

// The quick requests above the composer (#310), four at a time from a longer
// list (#366; hints.ts draws them). The row deals again when the panel opens,
// when another page opens and when a reply lands, and on More ideas; never
// while a run is under way. The pinned hint follows the page live: Shorten to
// fit shows the moment the open page runs over.
export function AssistantHints({
  context,
  page,
  busy,
  disabled,
  onPick,
}: {
  context: HintContext;
  /** The open page's number: another page deals afresh. */
  page: number;
  /** A run is under way: the row holds still until its reply lands. */
  busy: boolean;
  disabled: boolean;
  onPick: (id: PresetId) => void;
}) {
  const deck = useRef<Deck | null>(null);
  const latest = useRef(context);
  const [drawn, setDrawn] = useState<PresetId[]>([]);
  // What More ideas brought up, for a screen reader.
  const [told, setTold] = useState("");
  useEffect(() => {
    latest.current = context;
  });
  const deal = (fresh: boolean) => {
    const next = dealHints(deck.current, latest.current, fresh);
    deck.current = next.deck;
    setDrawn(next.drawn);
    return next.drawn;
  };
  const seen = useRef<{ page: number | null; busy: boolean }>({
    page: null,
    busy,
  });
  useEffect(() => {
    const was = seen.current;
    seen.current = { page: was.page, busy };
    // The first deal is on opening, a run or not; another page waits for it.
    if (was.page !== null && busy) return;
    if (was.page !== page) {
      seen.current.page = page;
      deal(true);
    } else if (was.busy) deal(false);
  }, [page, busy]);

  const pin = pinnedHint(context);
  const shown = [
    ...(pin ? [pin] : []),
    ...drawn.filter((id) => id !== pin && stillOffered(id, context)),
  ].slice(0, HINTS_SHOWN);

  return (
    <div data-assistant-hints className="flex flex-wrap gap-1.5">
      {shown.map((id) => (
        <button
          key={id}
          type="button"
          data-hint={id}
          aria-disabled={disabled || undefined}
          onClick={() => {
            if (!disabled) onPick(id);
          }}
          className={`${PILL} ${disabled ? "cursor-default opacity-45" : "hover:border-accent hover:text-accent-strong"}`}
        >
          {label(id)}
        </button>
      ))}
      {moreThanShown(context) && (
        <button
          type="button"
          data-more-ideas
          aria-disabled={disabled || undefined}
          onClick={() => {
            if (disabled) return;
            const next = deal(false);
            setTold(`New ideas: ${next.map(label).join(", ")}.`);
          }}
          className={`${PILL} text-muted ${disabled ? "cursor-default opacity-45" : "hover:border-accent hover:text-accent-strong"}`}
        >
          <Icon name="refresh" size={14} strokeWidth={2} />
          More ideas
        </button>
      )}
      <span className="sr-only" aria-live="polite">
        {told}
      </span>
    </div>
  );
}
