"use client";

import Link from "next/link";
import { DialogShell } from "@/components/dialog-shell";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";
import type { PdfState } from "./use-issue-pdf";

// The mobile reader's chrome: a sticky bar of labelled buttons (Contents,
// Smaller, Larger, PDF) and the full-screen contents list it opens.

export function MobileReaderBar({
  height,
  onContents,
  onSmaller,
  onLarger,
  pdfEnabled,
  pdfState,
  onDownloadPdf,
}: {
  height: number;
  onContents: () => void;
  onSmaller: () => void;
  onLarger: () => void;
  pdfEnabled: boolean;
  pdfState: PdfState;
  onDownloadPdf: () => void;
}) {
  const pdfLabel =
    pdfState === "loading"
      ? "Preparing…"
      : pdfState === "error"
        ? "Retry PDF"
        : "PDF";
  return (
    <header
      style={{ height }}
      className="bg-sheet border-lead sticky top-0 z-20 flex flex-none items-center justify-between gap-1 border-b-[3px] px-2"
    >
      <BarButton onClick={onContents} label="Contents" icon="menu" />
      <div
        role="group"
        aria-label="Text size"
        className="flex items-center gap-1"
      >
        <BarButton onClick={onSmaller} label="Smaller" ariaLabel="Smaller text">
          <span aria-hidden className="font-display text-[15px]">
            A−
          </span>
        </BarButton>
        <BarButton onClick={onLarger} label="Larger" ariaLabel="Larger text">
          <span aria-hidden className="font-display text-[19px] font-semibold">
            A+
          </span>
        </BarButton>
      </div>
      {/* Dropped entirely when the owner has switched downloads off (#162). */}
      {pdfEnabled && (
        <BarButton
          onClick={onDownloadPdf}
          label={pdfLabel}
          ariaLabel={
            pdfState === "loading"
              ? "Preparing PDF…"
              : pdfState === "error"
                ? "PDF failed — tap to retry"
                : "Download PDF"
          }
          disabled={pdfState === "loading"}
          icon={pdfState === "loading" ? undefined : "download"}
        >
          {pdfState === "loading" && (
            <span
              aria-hidden="true"
              className="h-[16px] w-[16px] animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
            />
          )}
        </BarButton>
      )}
    </header>
  );
}

// A compact labelled button for the bar: the word always, an icon beside it.
function BarButton({
  onClick,
  label,
  ariaLabel,
  icon,
  disabled = false,
  children,
}: {
  onClick: () => void;
  label: string;
  ariaLabel?: string;
  icon?: "menu" | "download";
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`text-lead flex h-11 items-center gap-1.5 rounded-ui px-2 font-ui text-[14px] font-semibold whitespace-nowrap transition-colors ${
        disabled ? "cursor-default" : "hover:bg-newsprint cursor-pointer"
      }`}
    >
      {icon && <Icon name={icon} size={18} strokeWidth={1.8} />}
      {children}
      {label}
    </button>
  );
}

// The contents list, full screen: big rule-separated rows and a Close button.
// A modal, so it goes through DialogShell for the focus trap, Escape and the
// return of focus to the Contents button.
export function MobileContents({
  headings,
  onGo,
  onClose,
}: {
  headings: { id: string; title: string }[];
  onGo: (blockId: string) => void;
  onClose: () => void;
}) {
  return (
    <DialogShell
      panelClassName="bg-sheet fixed inset-0 flex flex-col overflow-hidden"
      onClose={onClose}
    >
      {(titleId) => (
        <>
          <div className="border-lead flex h-14 flex-none items-center justify-between border-b-[3px] px-4">
            <h2 id={titleId} className="small-caps text-red">
              In this issue
            </h2>
            <Button variant="link" size="sm" onClick={onClose} icon="close">
              Close
            </Button>
          </div>
          <nav
            aria-label="In this issue"
            className="scrollbar-soft flex-1 overflow-y-auto px-4 pb-8"
          >
            <Link
              href="/"
              className="text-lead rule-hair flex min-h-12 items-center gap-1.5 font-ui text-[15px] font-semibold"
            >
              ← Back to the library
            </Link>
            {headings.length === 0 && (
              <p className="text-grey-soft py-4 font-ui text-[16px]">
                Headings appear here.
              </p>
            )}
            <ol>
              {headings.map((h, i) => (
                <li key={h.id} className="rule-hair">
                  <button
                    type="button"
                    onClick={() => onGo(h.id)}
                    className="hover:bg-newsprint flex min-h-14 w-full cursor-pointer items-baseline gap-3 py-3 text-left"
                  >
                    <span className="text-lead w-7 flex-none font-ui text-[14px] font-bold tabular-nums">
                      {i + 1}.
                    </span>
                    <span className="text-lead font-display text-[20px] leading-snug">
                      {h.title}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        </>
      )}
    </DialogShell>
  );
}
