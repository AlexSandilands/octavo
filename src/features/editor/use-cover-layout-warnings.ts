import {
  useEffectEvent,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { Page } from "@/lib/blocks";
import { hasCoverLayout, type CoverSource } from "@/lib/cover-elements";

export function useCoverLayoutWarnings(
  page: Page | undefined,
  canvas: RefObject<HTMLDivElement | null>,
  sources: CoverSource[],
) {
  const [warnings, setWarnings] = useState<string[]>([]);
  const previous = useRef("");
  const enabled = Boolean(page && hasCoverLayout(page));
  const measure = useEffectEvent(() => {
    const root = canvas.current,
      frame = root?.closest<HTMLElement>("[data-page-frame]");
    const next: string[] = [];
    const ids = new Set(sources.map((s) => s.id));
    if (
      page?.coverElements?.some((e) =>
        e.type === "contents"
          ? e.items.some((i) => !ids.has(i.headingId))
          : e.type === "teaser" && e.headingId && !ids.has(e.headingId),
      )
    )
      next.push(
        "A linked section is no longer available. Review the affected preview or story teaser.",
      );
    if (enabled && root && frame) {
      const pageRect = frame.getBoundingClientRect();
      const scale = pageRect.width / frame.offsetWidth;
      const pad = 40 * scale;
      const entries = [
        ...root.querySelectorAll<HTMLElement>("[data-cover-entry]"),
      ]
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.height > 0 && r.width > 0);
      if (
        entries.some(
          (r) =>
            r.left < pageRect.left + pad - 1 ||
            r.right > pageRect.right - pad + 1 ||
            r.top < pageRect.top + pad - 1 ||
            r.bottom > pageRect.bottom - pad + 1,
        )
      )
        next.push(
          "Some cover content extends beyond the page margins. Adjust its position, width or length.",
        );
      if (
        entries.some((a, i) =>
          entries
            .slice(i + 1)
            .some(
              (b) =>
                Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 &&
                Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2,
            ),
        )
      )
        next.push(
          "Some cover elements overlap. Move them to another position or use a narrower width.",
        );
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
