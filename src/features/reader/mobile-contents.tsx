"use client";

import Link from "next/link";
import { DialogShell } from "@/components/dialog-shell";
import { DialogHeader } from "@/components/dialog-parts";
import { Icon } from "@/components/icons";
import type { Block } from "@/lib/blocks";

type Heading = Extract<Block, { type: "heading" }>;

// The mobile reader's contents: a bottom sheet (DialogShell) listing the
// issue's headings, with the way back to the library at the foot.
export function MobileContents({
  headings,
  magazineName,
  issueNo,
  onClose,
  onPick,
}: {
  headings: Heading[];
  magazineName: string;
  issueNo: number;
  onClose: () => void;
  onPick: (blockId: string) => void;
}) {
  return (
    <DialogShell panelClassName="md:w-[420px]" onClose={onClose}>
      {(titleId) => (
        <>
          <DialogHeader
            titleId={titleId}
            kicker={`${magazineName} · No. ${issueNo}`}
            title="In this issue"
            onClose={onClose}
          />
          <nav aria-label="Contents" className="p-3 pt-4">
            {headings.length === 0 && (
              <p className="text-fg-muted px-3 py-2 font-ui text-[16px]">
                Headings appear here.
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {headings.map((h, i) => (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => onPick(h.id)}
                    className="text-fg hover:bg-primary-wash hover:text-primary flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-field px-3 py-2 text-left transition-colors"
                  >
                    <span className="bg-surface-2 text-fg-muted flex h-8 w-8 flex-none items-center justify-center rounded-full font-ui text-[13px] font-bold tabular-nums">
                      {i + 1}
                    </span>
                    <span className="font-ui text-[17px] leading-snug font-bold">
                      {h.title}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="border-hairline mt-3 border-t pt-3">
              <Link
                href="/"
                className="text-fg-muted hover:bg-primary-wash hover:text-primary flex h-12 items-center gap-3 rounded-field px-3 font-ui text-[16px] font-bold transition-colors"
              >
                <Icon name="arrowLeft" size={20} strokeWidth={2} />
                Back to the library
              </Link>
            </div>
          </nav>
        </>
      )}
    </DialogShell>
  );
}
