"use client";

import { useEffect, useMemo, useState } from "react";
import type { Page } from "@/lib/blocks";

// The pages the member has open (issue #304) — what a comment can be tagged
// to and what Show → This page narrows the thread to. By id, never number.

/** Desktop: both halves of the spread, since the reader can't know which one
 *  is being read — or the cover, which stands alone. */
export function spreadPages(pages: Page[], spread: number): string[] {
  const first = spread === 0 ? 0 : 2 * spread - 1;
  return pages.slice(first, first + (spread === 0 ? 1 : 2)).map((p) => p.id);
}

/** Each section of the phone's column carries its page's id in this. */
export const PAGE_ATTR = "data-reader-page";
export const pageDomId = (pageId: string) => `page-${pageId}`;

/**
 * Phone: the one section being read — the last whose top has passed the
 * viewport's upper third, or the very last once the column is scrolled to its
 * end (a short closing page never reaches that line). Measured at most once a
 * frame while the column scrolls; frozen while `paused`, since the sheet over
 * it has the column locked. `layout` re-measures when the text size reflows it.
 */
export function useCurrentPages(paused: boolean, layout: unknown): string[] {
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    if (paused) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const sections = document.querySelectorAll(`[${PAGE_ATTR}]`);
      if (sections.length === 0) return;
      const atEnd =
        window.scrollY > 0 &&
        window.scrollY + window.innerHeight >=
          document.documentElement.scrollHeight - 2;
      let found = sections[atEnd ? sections.length - 1 : 0]!;
      if (!atEnd) {
        const line = window.innerHeight / 3;
        for (const section of sections) {
          if (section.getBoundingClientRect().top > line) break;
          found = section;
        }
      }
      setCurrent(found.getAttribute(PAGE_ATTR));
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(measure);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [paused, layout]);

  return useMemo(() => (current ? [current] : []), [current]);
}

/** A page's section in the column — or, for a page with nothing on it (and so
 *  no section), the next one that has one, else the one before. */
export function pageSection(pages: Page[], pageId: string): HTMLElement | null {
  const at = pages.findIndex((p) => p.id === pageId);
  if (at < 0) return null;
  const order = [...pages.slice(at), ...pages.slice(0, at).reverse()];
  for (const page of order) {
    const el = document.getElementById(pageDomId(page.id));
    if (el) return el;
  }
  return null;
}
