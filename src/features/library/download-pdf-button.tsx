"use client";

import { Icon } from "@/components/icons";
import { Button, type ButtonTone } from "@/components/ui";
import { useIssuePdf } from "@/features/reader/use-issue-pdf";

// The latest-issue card's "Download PDF" action. A secondary button that mirrors
// the reader's PDF control: the first hit generates on the server (a spinner
// covers the wait), a failure surfaces a legible retry rather than a dead click.
export function DownloadPdfButton({
  issueNumber,
  tone = "paper",
}: {
  issueNumber: number;
  tone?: ButtonTone;
}) {
  const pdf = useIssuePdf(issueNumber);
  const label =
    pdf.state === "loading"
      ? "Preparing…"
      : pdf.state === "error"
        ? "Retry PDF"
        : "Download PDF";

  return (
    <Button
      variant="secondary"
      tone={tone}
      onClick={pdf.download}
      busy={pdf.state === "loading"}
      aria-label={
        pdf.state === "error" ? "PDF failed — tap to retry" : "Download PDF"
      }
    >
      {/* Colour the whole label+icon on error via the child element so it wins
          the cascade regardless of the variant's own text colour. */}
      <span
        className={`inline-flex items-center gap-2 ${
          pdf.state === "error"
            ? tone === "dark"
              ? "text-danger-bright"
              : "text-danger"
            : ""
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
      </span>
    </Button>
  );
}
