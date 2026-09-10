"use client";

import { useRef, useState } from "react";
import type { Page } from "@/lib/blocks";
import {
  PDF_LIMITS,
  type ImportKind,
  type Region,
  type ReviewItem,
  type SourceMapping,
  type SourcePage,
} from "./model";
import { reviewItem, sourceState } from "./synthesis";

const byReadingOrder = (a: ReviewItem, b: ReviewItem) =>
  a.page - b.page || a.order - b.order;

// What the author has picked on the PDF, in the order it will be added: source
// page then reading order until they reorder by hand. Also remembers which
// regions were added this session, derived from the blocks still in the draft
// so an undo clears the mark.
export function useImportSelection(pages: Page[]) {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [mapping, setMapping] = useState<SourceMapping>({});
  const [limit, setLimit] = useState("");
  const reordered = useRef(false);

  const commit = (next: ReviewItem[]) => {
    const bytes = next.reduce(
      (n, item) =>
        n +
        (item.region.image?.blob.size ?? 0) +
        JSON.stringify(item.block).length * 2,
      0,
    );
    if (
      next.length > PDF_LIMITS.selectionItems ||
      bytes > PDF_LIMITS.selectionBytes
    ) {
      setLimit("That is too much for one batch. Add what is selected first.");
      return;
    }
    setLimit("");
    setItems(reordered.current ? next : [...next].sort(byReadingOrder));
  };
  const itemFor = (regionId: string) =>
    items.find((i) => i.sources.includes(regionId));

  return {
    items,
    limit,
    itemFor,
    /** "imported" / "partial" when this region's blocks are in the draft now. */
    stateOf: (regionId: string) => sourceState(mapping[regionId] ?? [], pages),
    toggle: (region: Region) => {
      const existing = itemFor(region.id);
      commit(
        existing
          ? items.filter((i) => i !== existing)
          : [...items, reviewItem(region)],
      );
    },
    setKind: (region: Region, kind: ImportKind) => {
      const existing = itemFor(region.id);
      commit(
        existing
          ? items.map((i) =>
              i === existing ? reviewItem(region, kind, i.id) : i,
            )
          : [...items, reviewItem(region, kind)],
      );
    },
    selectAll: (page: SourcePage) =>
      commit([
        ...items,
        ...page.regions.filter((r) => !itemFor(r.id)).map((r) => reviewItem(r)),
      ]),
    remove: (id: string) => commit(items.filter((i) => i.id !== id)),
    move: (id: string, dir: -1 | 1) => {
      const from = items.findIndex((i) => i.id === id);
      const to = from + dir;
      if (from < 0 || to < 0 || to >= items.length) return;
      reordered.current = true;
      const next = [...items];
      [next[from], next[to]] = [next[to]!, next[from]!];
      setItems(next);
    },
    /** A region that no longer exists (it was split) leaves the selection. */
    dropSource: (regionId: string) =>
      commit(items.filter((i) => !i.sources.includes(regionId))),
    clear: () => {
      reordered.current = false;
      setLimit("");
      setItems([]);
    },
    markAdded: (added: SourceMapping) =>
      setMapping((old) => {
        const next = { ...old };
        for (const [id, blocks] of Object.entries(added))
          next[id] = [...(next[id] ?? []), ...blocks];
        return next;
      }),
    forget: () => {
      reordered.current = false;
      setLimit("");
      setItems([]);
      setMapping({});
    },
  };
}
