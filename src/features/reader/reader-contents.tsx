"use client";

import { IconButton, Label } from "@/components/ui";
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

// The reader's left rail, in the dark chrome. Collapsed it is a thin strip
// with the one control that opens it; expanded it shows the live contents
// list, the current spread's heading marked in brass. Navigation is delegated
// back to the reader.
export function ReaderContents({
  collapsed,
  setCollapsed,
  toc,
  spread,
  issueNo,
  magazineName,
  viewOf,
  onNavigate,
}: {
  collapsed: boolean;
  setCollapsed: (v: boolean | ((c: boolean) => boolean)) => void;
  toc: TocEntry[];
  spread: number;
  issueNo: number;
  /** The magazine's effective name (issue #105). */
  magazineName: string;
  viewOf: (page: number) => number;
  onNavigate: (page: number) => void;
}) {
  if (collapsed) {
    return (
      <aside className="border-hairline bg-raised flex w-14 flex-none flex-col items-center gap-4 border-r py-3">
        <IconButton
          icon="menu"
          label="Show contents"
          title="Expand contents"
          tone="dark"
          onClick={() => setCollapsed(false)}
        />
        <span className="text-chrome-muted font-meta text-[11px] tracking-[0.16em] uppercase [writing-mode:vertical-rl]">
          Contents
        </span>
      </aside>
    );
  }

  return (
    <aside className="border-hairline bg-raised flex w-[272px] flex-none flex-col border-r">
      <div className="flex h-14 flex-none items-center justify-between pr-2 pl-5">
        <Label tone="dark">Contents</Label>
        <IconButton
          icon="chevronLeft"
          label="Hide contents"
          title="Collapse"
          tone="dark"
          onClick={() => setCollapsed(true)}
        />
      </div>
      <p className="text-chrome-muted flex-none px-5 pb-3 font-meta text-[12px] tracking-[0.1em] uppercase">
        {magazineName} · No. {issueNo}
      </p>
      <nav className="scrollbar-soft scrollbar-dark border-hairline flex-1 overflow-y-auto border-t py-2 [scrollbar-gutter:stable]">
        {toc.length === 0 && (
          <p className="text-chrome-muted px-5 py-3 font-ui text-[15px]">
            Headings appear here.
          </p>
        )}
        {toc.map((t) => {
          const active = viewOf(t.page) === spread;
          return (
            <button
              key={`${t.page}-${t.label}`}
              type="button"
              onClick={() => onNavigate(t.page)}
              aria-current={active ? "true" : undefined}
              className={`flex w-full cursor-pointer items-baseline justify-between gap-3 border-l-[3px] py-3 pr-4 pl-4 text-left transition-colors ${
                active
                  ? "border-brass bg-lifted"
                  : "hover:bg-lifted border-transparent"
              }`}
            >
              <span
                className={`font-display text-[16px] leading-snug ${
                  active ? "text-brass" : "text-chrome-text"
                }`}
              >
                {t.label}
              </span>
              <span className="text-chrome-muted font-meta text-[12px] tabular-nums">
                {t.page}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
