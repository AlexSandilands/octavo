"use client";

import { useEffect, useRef } from "react";
import type { ImportKind, Region, ReviewItem, SourcePage } from "./model";
import { RegionOverlay } from "./region-overlay";

// The rendered PDF page with every detected region laid over it, filling the
// box the stage lays out for it. The canvas comes from the source's cache and
// is adopted into the DOM here, so it is drawn once however many times the
// author pages back and forth.
export function PageView({
  page,
  addCount,
  disabled,
  itemFor,
  stateOf,
  onToggle,
  onKind,
  onSplit,
  onAdd,
}: {
  page: SourcePage;
  addCount: number;
  disabled: boolean;
  itemFor: (regionId: string) => ReviewItem | undefined;
  stateOf: (regionId: string) => "imported" | "partial" | null;
  onToggle: (region: Region) => void;
  onKind: (region: Region, kind: ImportKind) => void;
  onSplit: (region: Region) => void;
  onAdd: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const canvas = page.canvas;
    element.append(canvas);
    return () => canvas.remove();
  }, [page]);
  return (
    <div className="relative h-full w-full bg-white">
      <div ref={host} className="absolute inset-0" />
      {page.regions.map((region) => (
        <RegionOverlay
          key={region.id}
          region={region}
          page={page}
          item={itemFor(region.id)}
          added={stateOf(region.id)}
          addCount={addCount}
          disabled={disabled}
          onToggle={() => onToggle(region)}
          onKind={(kind) => onKind(region, kind)}
          onSplit={() => onSplit(region)}
          onAdd={onAdd}
        />
      ))}
    </div>
  );
}
