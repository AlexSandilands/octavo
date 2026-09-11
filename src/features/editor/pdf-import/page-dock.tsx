"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui";
import { BarDivider, FloatingBar } from "../floating-bar";
import { ToolButton } from "../tool-button";
import type { BarLayout } from "../use-bar-layout";
import type { AddStatus } from "./use-add-selection";

// The PDF panel's tool bar, floating over the foot of its stage in the same
// pill as the editor's own tools: paging, the selection (how much, press to see
// the list in the order it will be added; select everything on the page; clear)
// and the one Add that sends it all. News — progress, the outcome, a refusal —
// is a caption at the foot, otherwise heard only; the open selection list sits
// above that. Labels go first as the panel narrows, then the bar stands on end
// at the panel's outer edge and the count moves onto the list button (`layout`).
export function PageDock({
  layout,
  pageNumber,
  pageCount,
  busy,
  count,
  listOpen,
  canSelectAll,
  adding,
  status,
  onNavigate,
  onToggleList,
  onSelectAll,
  onClear,
  onAdd,
  onCancel,
  children,
}: {
  layout: BarLayout;
  pageNumber: number;
  pageCount: number;
  /** The source is reading a page: paging waits, selection does not. */
  busy: boolean;
  count: number;
  listOpen: boolean;
  canSelectAll: boolean;
  adding: boolean;
  status: AddStatus | null;
  onNavigate: (page: number) => void;
  onToggleList: () => void;
  onSelectAll: () => void;
  onClear: () => void;
  onAdd: () => void;
  onCancel: () => void;
  /** The selection list, when open. */
  children?: ReactNode;
}) {
  const vertical = layout === "vertical";
  const showLabel = layout === "labels";
  const addLabel = adding ? "Adding…" : count > 1 ? `Add ${count}` : "Add";
  return (
    <>
      {/* The list and the news keep to the foot, clear of a standing bar. */}
      <div
        className={`pointer-events-none absolute z-30 flex flex-col items-center gap-2 ${
          vertical ? "right-[92px] bottom-5 left-4" : "inset-x-4 bottom-[86px]"
        }`}
      >
        {children}
        {/* Always mounted so a screen reader hears the change; visible only
            when there is something to say. */}
        <p
          role="status"
          aria-live="polite"
          className={
            status
              ? `border-hair-warm pointer-events-auto max-w-full rounded-full border bg-white px-3.5 py-1 text-center text-[13px] leading-snug shadow-[0_4px_14px_rgba(40,36,28,0.12)] ${
                  status.tone === "warn" ? "text-warn" : "text-faint"
                }`
              : "sr-only"
          }
        >
          {status?.text}
        </p>
      </div>
      <FloatingBar
        vertical={vertical}
        side="right"
        label="PDF tools"
        groupProps={{ "data-add-bar": true } as Record<string, boolean>}
      >
        {/* `unavailable` keeps an exhausted control focusable, so paging to
            the end doesn't drop keyboard focus. */}
        <ToolButton
          icon="chevronLeft"
          label="Previous PDF page"
          unavailable={busy || pageNumber <= 1}
          onClick={() => onNavigate(pageNumber - 1)}
        />
        <span
          aria-live="polite"
          className={`text-ink text-center font-sans text-[13px] font-semibold tabular-nums ${
            vertical ? "" : "min-w-[56px]"
          }`}
        >
          {pageNumber} / {pageCount}
        </span>
        <ToolButton
          icon="chevronRight"
          label="Next PDF page"
          unavailable={busy || pageNumber >= pageCount}
          onClick={() => onNavigate(pageNumber + 1)}
        />
        <BarDivider vertical={vertical} />
        <ToolButton
          icon="listBullet"
          label={count ? `${count} selected` : "Nothing selected"}
          hint={
            count
              ? "Show the selection in the order it will be added"
              : "Nothing selected yet"
          }
          showLabel={showLabel}
          badge={showLabel ? undefined : count || undefined}
          pressed={listOpen}
          expanded={listOpen}
          controls="pdf-import-selection"
          unavailable={!count}
          onClick={onToggleList}
        />
        <ToolButton
          icon="selectAll"
          label="Select all on page"
          hint="Select every region on this page"
          iconClass="text-accent"
          showLabel={showLabel}
          unavailable={!canSelectAll || adding}
          onClick={onSelectAll}
        />
        {count > 0 && (
          <ToolButton
            icon="selectNone"
            label="Clear"
            hint="Clear the selection"
            showLabel={showLabel}
            unavailable={adding}
            onClick={onClear}
          />
        )}
        <BarDivider vertical={vertical} />
        {adding &&
          (vertical ? (
            <ToolButton icon="close" label="Cancel" onClick={onCancel} />
          ) : (
            <Button size="sm" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          ))}
        {/* Add keeps its place while working, so a double press lands on a
            busy button rather than on Cancel. Standing, it is the icon alone
            and the count shows on the list button instead. */}
        <Button
          size="sm"
          icon="plus"
          iconPosition="left"
          disabled={!count}
          busy={adding}
          onClick={onAdd}
        >
          {vertical ? <span className="sr-only">{addLabel}</span> : addLabel}
        </Button>
      </FloatingBar>
    </>
  );
}
