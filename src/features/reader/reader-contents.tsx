"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";
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

// The reader's left rail. Collapsed it is a thin strip of controls; expanded it
// shows the masthead standfirst and the live contents list, the current spread's
// heading highlighted. Navigation is delegated back to the reader.
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
      <aside className="bg-card border-line flex w-[54px] flex-none flex-col items-center gap-4 border-r py-5">
        <Link
          href="/"
          title="Back to library"
          className="text-muted hover:text-brass-ink"
        >
          <Icon name="chevronLeft" size={20} />
        </Link>
        <div className="bg-line h-px w-6" />
        <button
          onClick={() => setCollapsed(false)}
          className="text-brass-ink"
          title="Expand contents"
        >
          <Icon name="menu" size={20} />
        </button>
        <div className="bg-line h-px w-6" />
        <span className="text-faint2 font-meta text-[10px] tracking-[0.1em] [writing-mode:vertical-rl]">
          CONTENTS
        </span>
      </aside>
    );
  }

  return (
    <aside className="bg-card border-line flex w-[248px] flex-none flex-col border-r py-5">
      <Link
        href="/"
        className="text-muted hover:text-brass-ink mb-4 flex items-center gap-1.5 px-5 font-ui text-[13px] font-medium"
      >
        <Icon name="chevronLeft" size={16} />
        Library
      </Link>
      <div className="flex items-center justify-between px-5">
        <span className="text-brass-ink font-ui text-[11px] font-semibold tracking-[0.2em] uppercase">
          Contents
        </span>
        <button
          onClick={() => setCollapsed(true)}
          className="text-muted"
          title="Collapse"
        >
          <Icon name="chevronLeft" size={18} />
        </button>
      </div>
      <p className="text-faint px-5 pt-2 font-display text-[13px] italic">
        {magazineName} · No. {issueNo}
      </p>
      <div className="bg-line mx-5 my-4 h-px" />
      <nav className="scrollbar-soft flex-1 overflow-y-auto [--scrollbar-surface:var(--color-card)] [scrollbar-gutter:stable]">
        {toc.length === 0 && (
          <p className="text-faint2 px-5 font-ui text-[13px]">
            Headings appear here.
          </p>
        )}
        {toc.map((t) => {
          const active = viewOf(t.page) === spread;
          return (
            <button
              key={`${t.page}-${t.label}`}
              onClick={() => onNavigate(t.page)}
              aria-current={active ? "true" : undefined}
              className={`flex w-full items-baseline justify-between gap-2.5 border-l-2 px-5 py-2.5 text-left ${
                active ? "border-brass-ink" : "border-transparent"
              }`}
            >
              <span
                className={`font-display text-[15px] leading-snug ${
                  active ? "text-brass-ink" : "text-body"
                }`}
              >
                {t.label}
              </span>
              <span className="text-faint2 font-meta text-[11px]">
                {t.page}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
