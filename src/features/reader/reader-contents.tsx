"use client";

import { Button } from "@/components/ui";
import type { Page } from "@/lib/blocks";

export type TocEntry = { label: string; page: number };

export function buildToc(pages: Page[]): TocEntry[] {
  const toc: TocEntry[] = [];
  pages.forEach((p, i) => {
    for (const b of p.blocks) {
      // Run-in paragraph sub-heads are too granular for the contents list.
      if (
        b.type === "heading" &&
        b.title.trim() &&
        (b.level ?? "main") !== "paragraph"
      ) {
        toc.push({ label: b.title, page: i + 1 });
      }
    }
  });
  return toc;
}

// The reader's contents panel: a white column of rule-separated rows (page
// number · heading), the current spread's entry marked with the red rule.
// Opened and closed from the toolbar's labelled "Contents" button; the panel's
// own "Close" is the same toggle. Navigation is delegated back to the reader.
export function ReaderContents({
  toc,
  spread,
  issueNo,
  magazineName,
  viewOf,
  onNavigate,
  onClose,
}: {
  toc: TocEntry[];
  spread: number;
  issueNo: number;
  /** The magazine's effective name (issue #105). */
  magazineName: string;
  viewOf: (page: number) => number;
  onNavigate: (page: number) => void;
  onClose: () => void;
}) {
  return (
    <aside
      aria-label="Contents"
      className="bg-sheet border-hairline flex w-[300px] flex-none flex-col border-r"
    >
      <div className="flex items-center justify-between gap-3 px-5 pt-4">
        <div>
          <span className="small-caps text-red">Contents</span>
          <p className="text-grey-soft mt-1 font-ui text-[14px] tabular-nums">
            {magazineName} · No. {issueNo}
          </p>
        </div>
        <Button variant="link" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
      <nav
        aria-label="In this issue"
        className="scrollbar-soft rule-heavy mx-5 mt-3 flex-1 overflow-y-auto [scrollbar-gutter:stable]"
      >
        {toc.length === 0 && (
          <p className="text-grey-soft py-4 font-ui text-[15px]">
            Headings appear here.
          </p>
        )}
        <ol>
          {toc.map((t) => {
            const active = viewOf(t.page) === spread;
            return (
              <li key={`${t.page}-${t.label}`} className="rule-hair">
                <button
                  onClick={() => onNavigate(t.page)}
                  aria-current={active ? "true" : undefined}
                  className={`hover:bg-newsprint -mx-2 flex w-[calc(100%+1rem)] min-h-12 cursor-pointer items-baseline gap-3 border-l-4 px-2 py-2.5 text-left transition-colors ${
                    active ? "border-red" : "border-transparent"
                  }`}
                >
                  <span className="text-lead w-7 flex-none font-ui text-[14px] font-bold tabular-nums">
                    {t.page}
                  </span>
                  <span
                    className={`font-display text-[17px] leading-snug ${
                      active ? "text-red font-semibold" : "text-lead"
                    }`}
                  >
                    {t.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </aside>
  );
}
