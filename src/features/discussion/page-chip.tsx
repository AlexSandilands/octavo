"use client";

import { Icon } from "@/components/icons";
import { capitalise, pageName, type ReaderPages } from "./page-tags";

const FACE =
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-sans text-[13px] font-semibold";

// A tagged comment's page (issue #304): a 44px chip that takes the reader
// there, named by the page's number in the issue as it stands now. A page
// since deleted leaves the chip disabled as "Page removed".
export function PageChip({
  pageId,
  pages,
  onGo,
}: {
  pageId: string;
  pages: ReaderPages;
  onGo: (pageId: string) => void;
}) {
  const name = pageName(pages, pageId);
  if (!name) {
    return (
      <button
        type="button"
        disabled
        data-page-chip={pageId}
        className="inline-flex min-h-11 cursor-default items-center"
      >
        <span className={`${FACE} bg-chip text-faint`}>
          <Icon name="doc" size={14} />
          Page removed
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onGo(pageId)}
      aria-label={`Go to ${name}`}
      data-page-chip={pageId}
      className="group inline-flex min-h-11 cursor-pointer items-center rounded-full"
    >
      <span
        className={`${FACE} bg-tint text-accent group-hover:bg-cream transition-colors`}
      >
        <Icon name="doc" size={14} />
        {capitalise(name)}
      </span>
    </button>
  );
}
