"use client";

import { useEffect, useMemo, useRef } from "react";
import type { Page } from "@/lib/blocks";
import type { LogoListItem } from "@/lib/logos";
import type { SponsorListItem } from "@/lib/sponsors";
import type { MeasurementOptions } from "../pdf-import/measure";
import { createFillMeasurer } from "./measure-fills";
import type { AssistantSnapshot } from "./use-assistant-chat";

// What the assistant reads, gathered from the editor's own state (#309) and
// read at the moment a message or a tool call needs it — never a copy that
// could lag behind an edit. Fills are measured then, off screen, and cached per
// page by the measurer until the page or the page chrome changes.
export function useAssistantSnapshot({
  title,
  theme,
  pages,
  curPage,
  logos,
  sponsors,
  measure,
}: {
  title: string;
  theme: string;
  pages: Page[];
  curPage: number;
  logos: LogoListItem[];
  sponsors: SponsorListItem[];
  /** Everything a page's layout depends on besides its blocks. */
  measure: MeasurementOptions;
}): AssistantSnapshot {
  const {
    theme: layout,
    images,
    sponsors: sponsorMap,
    settings,
    logo,
    issueNo,
  } = measure;
  // A new measurer (and an empty cache) whenever the page chrome changes.
  const measurer = useMemo(
    () =>
      typeof document === "undefined"
        ? null
        : createFillMeasurer({
            theme: layout,
            images,
            sponsors: sponsorMap,
            settings,
            logo,
            issueNo,
          }),
    [layout, images, sponsorMap, settings, logo, issueNo],
  );
  useEffect(() => () => measurer?.dispose(), [measurer]);

  const latest = useRef({
    title,
    theme,
    pages,
    curPage,
    logos,
    sponsors,
    images,
    measurer,
  });
  useEffect(() => {
    latest.current = {
      title,
      theme,
      pages,
      curPage,
      logos,
      sponsors,
      images,
      measurer,
    };
  });

  return async () => {
    const now = latest.current;
    const logoImages = new Set(now.logos.map((l) => l.imageId));
    return {
      currentPage: now.curPage + 1,
      issue: {
        title: now.title,
        theme: now.theme,
        pages: now.pages,
        images: now.images,
        // Every photo the editor holds for this issue; the library's marks are logos, not photos.
        uploads: Object.keys(now.images).filter((id) => !logoImages.has(id)),
        logos: now.logos.map((l) => ({
          id: l.id,
          name: l.name,
          imageId: l.imageId,
        })),
        sponsorNames: now.sponsors.map((s) => s.name),
        fills: now.measurer ? await now.measurer.measure(now.pages) : {},
        // The cover tools (#313), placement and style included.
        coverTools: "style" as const,
      },
    };
  };
}
