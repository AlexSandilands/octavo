"use client";

import Link from "next/link";
import { DialogShell } from "@/components/dialog-shell";
import { DialogHeader } from "@/components/dialog-parts";
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

// The desktop reader's contents: a slide-over sheet from the left edge, via
// DialogShell so it is a proper dialog. Rows carry a page-number badge; the
// current spread's row is tinted. Choosing a row navigates and closes.
export function ReaderContents({
  onClose,
  toc,
  spread,
  issueNo,
  issueTitle,
  magazineName,
  viewOf,
  onNavigate,
}: {
  onClose: () => void;
  toc: TocEntry[];
  spread: number;
  issueNo: number;
  issueTitle: string;
  /** The magazine's effective name (issue #105). */
  magazineName: string;
  viewOf: (page: number) => number;
  onNavigate: (page: number) => void;
}) {
  return (
    <DialogShell placement="left" onClose={onClose}>
      {(titleId) => (
        <>
          <DialogHeader
            titleId={titleId}
            kicker={`${magazineName} · No. ${issueNo}`}
            title="Contents"
            onClose={onClose}
          />
          <p className="text-fg-muted mt-1 px-5 font-ui text-[15px] md:px-8">
            {issueTitle}
          </p>
          <nav
            aria-label="Contents"
            className="scrollbar-soft mt-4 flex-1 overflow-y-auto px-3 pb-4 [--scrollbar-surface:var(--color-surface)] [scrollbar-gutter:stable]"
          >
            {toc.length === 0 && (
              <p className="text-fg-muted px-3 font-ui text-[16px]">
                Headings appear here.
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {toc.map((t) => {
                const active = viewOf(t.page) === spread;
                return (
                  <li key={`${t.page}-${t.label}`}>
                    <button
                      type="button"
                      onClick={() => {
                        onNavigate(t.page);
                        onClose();
                      }}
                      aria-current={active ? "true" : undefined}
                      className={`flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-field px-3 py-2 text-left transition-colors ${
                        active
                          ? "bg-primary-soft text-primary"
                          : "text-fg hover:bg-primary-wash hover:text-primary"
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 flex-none items-center justify-center rounded-full font-ui text-[13px] font-bold tabular-nums ${
                          active
                            ? "bg-primary text-surface"
                            : "bg-surface-2 text-fg-muted"
                        }`}
                      >
                        {t.page}
                      </span>
                      <span className="font-ui text-[16px] leading-snug font-bold">
                        {t.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="border-hairline border-t p-3">
            <Link
              href="/"
              className="text-fg-muted hover:bg-primary-wash hover:text-primary flex h-12 items-center gap-3 rounded-field px-3 font-ui text-[16px] font-bold transition-colors"
            >
              <Icon name="arrowLeft" size={20} strokeWidth={2} />
              Back to the library
            </Link>
          </div>
        </>
      )}
    </DialogShell>
  );
}
