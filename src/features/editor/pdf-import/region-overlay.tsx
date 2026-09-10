"use client";

import { useState, type FocusEvent } from "react";
import { Icon } from "@/components/icons";
import { blockKind } from "../block-kinds";
import type { ImportKind, Region, ReviewItem, SourcePage } from "./model";
import { RegionMenu } from "./region-menu";
import { itemKind, regionLabel, suggestedKind } from "./region-text";

// How a region is drawn on the page in each state. Idle marks every region
// that can be picked up; the rest lift it as the author's attention arrives.
export const REGION_LOOK = {
  idle: "shadow-[0_0_0_1px_rgba(32,32,28,0.10),0_2px_10px_rgba(32,32,28,0.10)]",
  hover:
    "shadow-[0_0_0_1.5px_var(--color-accent),0_4px_16px_rgba(29,77,62,0.18)] bg-accent/8",
  selected:
    "shadow-[0_0_0_2px_var(--color-accent),0_4px_16px_rgba(29,77,62,0.20)] bg-accent/10",
  added: "shadow-[inset_0_0_0_1.5px_var(--color-ok)] bg-ok/6",
};

function Chip({
  kind,
  ghost,
  side,
}: {
  kind: ImportKind;
  ghost: boolean;
  side: "left" | "right";
}) {
  const k = blockKind(kind);
  return (
    <span
      className={`pointer-events-none absolute -top-2.5 z-10 flex items-center gap-1 rounded-full px-2 py-[3px] font-sans text-[11px] leading-none font-semibold ${
        side === "left" ? "left-1.5" : "right-1.5"
      } ${
        ghost
          ? "border-accent/50 text-accent border bg-white"
          : "bg-accent text-paper shadow-[0_2px_6px_rgba(29,77,62,0.3)]"
      }`}
    >
      <Icon name={k.icon} size={11} strokeWidth={2.2} />
      {k.label}
    </span>
  );
}

// One detected region drawn over the PDF: the press target, its kind chip and,
// once selected and under the pointer or focus, the tool pill.
export function RegionOverlay({
  region,
  page,
  item,
  added,
  addCount,
  disabled,
  onToggle,
  onKind,
  onSplit,
  onAdd,
}: {
  region: Region;
  page: SourcePage;
  item: ReviewItem | undefined;
  added: "imported" | "partial" | null;
  addCount: number;
  disabled: boolean;
  onToggle: () => void;
  onKind: (kind: ImportKind) => void;
  onSplit: () => void;
  onAdd: () => void;
}) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const selected = Boolean(item);
  const kind = item ? itemKind(item) : suggestedKind(region);
  const attention = hover || focus;
  const look = selected
    ? REGION_LOOK.selected
    : attention && !disabled
      ? REGION_LOOK.hover
      : added
        ? REGION_LOOK.added
        : REGION_LOOK.idle;
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setFocus(false);
  };
  return (
    <div
      className={`absolute ${selected || attention ? "z-10" : ""}`}
      style={{
        left: `${(region.x / page.width) * 100}%`,
        top: `${(region.y / page.height) * 100}%`,
        width: `${(region.width / page.width) * 100}%`,
        height: `${(region.height / page.height) * 100}%`,
      }}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={onBlur}
    >
      <button
        type="button"
        data-region={region.id}
        aria-pressed={selected}
        aria-label={regionLabel(region, kind, selected, added)}
        disabled={disabled}
        onClick={onToggle}
        className={`absolute inset-0 rounded-[3px] transition-[box-shadow,background-color] duration-150 ${
          disabled ? "cursor-default" : "cursor-pointer"
        } ${look}`}
      />
      {(selected || (attention && !disabled)) && (
        <Chip kind={kind} ghost={!selected} side="left" />
      )}
      {added && !selected && (
        <span className="bg-ok text-paper pointer-events-none absolute -top-2.5 right-1.5 z-10 flex items-center gap-1 rounded-full px-2 py-[3px] font-sans text-[11px] leading-none font-semibold">
          <Icon name="check" size={11} strokeWidth={2.4} />
          {added === "partial" ? "Partly added" : "Added"}
        </span>
      )}
      {selected && attention && !disabled && (
        <RegionMenu
          region={region}
          page={page}
          kind={kind}
          addCount={addCount}
          disabled={disabled}
          onKind={onKind}
          onSplit={onSplit}
          onAdd={onAdd}
        />
      )}
    </div>
  );
}
