"use client";

import { Button } from "@/components/ui";
import { ToolButton } from "../tool-button";
import { KindToggle } from "./kind-toggle";
import type { ImportKind, Region, SourcePage } from "./model";

// The small tool pill that appears over a selected region: what it becomes,
// a split for over-grouped text, and Add. It sits above the region, or below
// when the region is at the top of the page, and hangs from whichever side
// keeps it on the page. Padding rather than a margin keeps the hover contiguous.
export function RegionMenu({
  region,
  page,
  kind,
  addCount,
  disabled,
  onKind,
  onSplit,
  onAdd,
}: {
  region: Region;
  page: SourcePage;
  kind: ImportKind;
  addCount: number;
  disabled: boolean;
  onKind: (kind: ImportKind) => void;
  onSplit: () => void;
  onAdd: () => void;
}) {
  const below = region.y < page.height * 0.09;
  const fromRight = region.x + region.width / 2 > page.width / 2;
  const canSplit = region.kind === "text" && (region.lines?.length ?? 0) > 1;
  return (
    <div
      className={`absolute z-20 ${below ? "top-full pt-1.5" : "bottom-full pb-1.5"} ${
        fromRight ? "right-0" : "left-0"
      }`}
    >
      <div
        role="group"
        aria-label="Selected region"
        className="border-hair-warm flex items-center gap-1 rounded-[12px] border bg-white p-1.5 shadow-[0_8px_28px_rgba(40,36,28,0.22)]"
      >
        <KindToggle
          kind={kind}
          image={region.kind === "image"}
          showLabel="always"
          onChange={onKind}
        />
        {canSplit && (
          <>
            <span className="bg-line mx-0.5 h-6 w-px" />
            <ToolButton
              icon="split"
              label="Split"
              hint="Split into two regions at the widest gap"
              disabled={disabled}
              onClick={onSplit}
            />
          </>
        )}
        <span className="bg-line mx-0.5 h-6 w-px" />
        <Button
          size="sm"
          icon="plus"
          iconPosition="left"
          disabled={disabled}
          onClick={onAdd}
        >
          {addCount > 1 ? `Add ${addCount}` : "Add"}
        </Button>
      </div>
    </div>
  );
}
