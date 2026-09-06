"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconButton, Label } from "@/components/ui";

// The library's shelf of recent covers: one row that scrolls sideways, with
// Previous / Next buttons at its head and the arrow keys doing the same while
// focus is on the shelf. The cards arrive server-rendered as children (they
// draw real cover pages, which needs the server); this owns only the scrolling.
// The row has no visible scrollbar — the buttons are the affordance, and a
// cover cut off at the edge shows there is more.
export function CoverShelf({
  label,
  summary,
  children,
}: {
  label: string;
  /** e.g. "12 issues" — printed beside the label. */
  summary?: string;
  children: ReactNode;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  // Which way there is more, read off the row itself — so the buttons dim at
  // the ends, and stay dimmed when everything fits.
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const sync = () => {
      setCanPrev(row.scrollLeft > 4);
      setCanNext(row.scrollLeft + row.clientWidth < row.scrollWidth - 4);
    };
    sync();
    row.addEventListener("scroll", sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(row);
    return () => {
      row.removeEventListener("scroll", sync);
      ro.disconnect();
    };
  }, []);

  const scroll = (dir: -1 | 1) => {
    const row = rowRef.current;
    if (!row) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row.scrollBy({
      left: dir * Math.max(row.clientWidth * 0.8, 200),
      behavior: reduce ? "auto" : "smooth",
    });
  };

  return (
    <section
      aria-label={label}
      className="mt-4"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          scroll(1);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          scroll(-1);
        }
      }}
    >
      <div className="border-hairline flex items-end justify-between gap-4 border-b pb-3">
        <div className="flex items-baseline gap-3">
          <Label tone="dark">{label}</Label>
          {summary && (
            <span className="text-chrome-muted font-meta text-[12px]">
              {summary}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <IconButton
            icon="chevronLeft"
            label="Earlier on the shelf"
            tone="dark"
            disabled={!canPrev}
            onClick={() => scroll(-1)}
          />
          <IconButton
            icon="chevronRight"
            label="Later on the shelf"
            tone="dark"
            disabled={!canNext}
            onClick={() => scroll(1)}
          />
        </div>
      </div>
      {/* Bleeds to the page edges so the last visible cover is cut off there
          rather than at an inner margin; the padding puts the first cover back
          in line with the label. */}
      <div
        ref={rowRef}
        className="shelf-row -mx-5 flex gap-6 overflow-x-auto px-5 pt-7 pb-4 sm:-mx-8 sm:px-8"
      >
        {children}
      </div>
    </section>
  );
}
