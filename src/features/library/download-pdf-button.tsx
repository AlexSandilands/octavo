"use client";

import { Icon } from "@/components/icons";
import { useIssuePdf } from "@/features/reader/use-issue-pdf";

// The latest-issue card's "Download PDF" action. A secondary button that mirrors
// the reader's PDF control: the first hit generates on the server (a spinner
// covers the wait), a failure surfaces a legible retry rather than a dead click.
export function DownloadPdfButton({ issueNumber }: { issueNumber: number }) {
  const pdf = useIssuePdf(issueNumber);
  const label =
    pdf.state === "loading"
      ? "Preparing…"
      : pdf.state === "error"
        ? "Retry PDF"
        : "Download PDF";

  return (
    <button
      type="button"
      onClick={pdf.download}
      disabled={pdf.state === "loading"}
      aria-label={
        pdf.state === "error" ? "PDF failed — tap to retry" : "Download PDF"
      }
      className={`border-hair inline-flex h-12 items-center justify-center gap-2 rounded-lg border-[1.5px] bg-white px-5 font-sans text-[15px] font-semibold transition-colors hover:bg-paper disabled:cursor-default ${
        pdf.state === "error" ? "text-alert" : "text-ink"
      }`}
    >
      {label}
      {pdf.state === "loading" ? (
        <span
          aria-hidden="true"
          className="h-[17px] w-[17px] animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
        />
      ) : (
        <Icon name="download" size={17} strokeWidth={1.8} />
      )}
    </button>
  );
}
