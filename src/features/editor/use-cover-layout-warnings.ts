import {
  useEffectEvent,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { Page } from "@/lib/blocks";
import { type CoverSource } from "@/lib/cover-elements";
import { coverItemLabel, coverItems, hasCoverLayout } from "@/lib/cover-order";

/** One thing to look at, naming the item(s) so the inspector can point at them. */
export type CoverWarning = { ids: string[]; text: string };

// How far past the 40px page margin an item may reach before it's worth a
// word: a nudged heading a few pixels into the margin still sits well inside
// the theme's frame, and the reader never clips there.
const MARGIN_SLACK = 12;

export function useCoverLayoutWarnings(
  page: Page | undefined,
  canvas: RefObject<HTMLDivElement | null>,
  sources: CoverSource[],
) {
  const [warnings, setWarnings] = useState<CoverWarning[]>([]);
  const previous = useRef("");
  const enabled = Boolean(page && hasCoverLayout(page));
  const measure = useEffectEvent(() => {
    const root = canvas.current,
      frame = root?.closest<HTMLElement>("[data-page-frame]");
    const next: CoverWarning[] = [];
    const items = page ? coverItems(page) : [];
    const label = (id: string) => {
      const item = items.find((i) => i.id === id);
      return item ? coverItemLabel(item) : "An item";
    };
    const ids = new Set(sources.map((s) => s.id));
    for (const e of page?.coverElements ?? []) {
      const broken =
        e.type === "section" &&
        e.items.some((i) => i.headingId && !ids.has(i.headingId));
      if (broken)
        next.push({
          ids: [e.id],
          text: `${coverItemLabel(e)} links to a section that no longer exists.`,
        });
    }
    if (enabled && root && frame) {
      const pageRect = frame.getBoundingClientRect();
      const scale = pageRect.width / frame.offsetWidth;
      const pad = (40 - MARGIN_SLACK) * scale;
      const entries = [
        ...root.querySelectorAll<HTMLElement>("[data-cover-entry]"),
      ]
        .map((el) => ({
          id: el.dataset.coverEntry!,
          r: el.getBoundingClientRect(),
        }))
        .filter(({ r }) => r.height > 0 && r.width > 0);
      for (const { id, r } of entries) {
        if (
          r.left < pageRect.left + pad - 1 ||
          r.right > pageRect.right - pad + 1 ||
          r.top < pageRect.top + pad - 1 ||
          r.bottom > pageRect.bottom - pad + 1
        )
          next.push({
            ids: [id],
            text: `${label(id)} runs past the page margin.`,
          });
      }
      entries.forEach((a, i) => {
        for (const b of entries.slice(i + 1)) {
          if (
            Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left) > 2 &&
            Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top) > 2
          )
            next.push({
              ids: [a.id, b.id],
              text: `${label(a.id)} overlaps ${label(b.id).toLowerCase()}.`,
            });
        }
      });
    }
    const serialized = JSON.stringify(next);
    if (serialized !== previous.current) {
      previous.current = serialized;
      setWarnings(next);
    }
  });
  useEffect(() => measure());
  useEffect(() => {
    const root = canvas.current;
    if (!root) return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(root);
    root
      .querySelectorAll("[data-cover-entry]")
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [canvas, page, enabled]);
  return warnings;
}
