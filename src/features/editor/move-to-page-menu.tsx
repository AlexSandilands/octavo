"use client";

import { useMemo } from "react";
import { Icon } from "@/components/icons";
import { MenuSelect, type MenuSelectItem } from "@/components/menu-select";
import type { Page } from "@/lib/blocks";
import {
  capitalise,
  pageIndex,
  pageName,
} from "@/features/discussion/page-tags";
import { acceptsMovedBlock } from "./move-block";

export type MoveToPage = {
  pages: Page[];
  current: number;
  onMove: (index: number) => void;
};

// Every page, named and hinted as the discussion's page tags are; the block lands at the end.
export function MoveToPageMenu({ pages, current, onMove }: MoveToPage) {
  const index = useMemo(() => pageIndex(pages), [pages]);
  const items: MenuSelectItem<number>[] = pages.map((page, i) => {
    const hint = index.hints.get(page.id);
    return {
      key: page.id,
      value: i,
      disabled: i === current || !acceptsMovedBlock(page),
      content: (
        <span className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span data-page-label className="flex-none">
            {capitalise(pageName(index, page.id) ?? "")}
          </span>
          {hint && (
            <span
              data-page-hint
              className="text-faint min-w-0 truncate text-[13px] font-normal"
            >
              {hint}
            </span>
          )}
        </span>
      ),
    };
  });
  return (
    // The menu is portalled, so its presses would reach the stage through React
    // and start a canvas pan that captures the pointer away from the click.
    <div onPointerDown={(e) => e.stopPropagation()}>
      <MenuSelect
        label=""
        current=""
        triggerLabel="Move to page…"
        ariaLabel="Move to page"
        size="ctrl"
        iconOnly
        portal
        icon={<Icon name="doc" size={13} strokeWidth={1.9} />}
        disabled={!items.some((item) => !item.disabled)}
        items={items}
        value={current}
        onSelect={onMove}
        returnFocusOnSelect={false}
      />
    </div>
  );
}
