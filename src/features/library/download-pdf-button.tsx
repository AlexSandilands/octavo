"use client";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";
import { useIssuePdf } from "@/features/reader/use-issue-pdf";

// The library's "Download PDF" action — the outlined button beside "Read this
// issue" on the front page, or a text link at the end of a back-issue row.
// Mirrors the reader's PDF control: the first hit generates on the server (a
// spinner covers the wait), a failure surfaces a legible retry rather than a
// dead click.
export function DownloadPdfButton({
  issueNumber,
  variant = "secondary",
  full = false,
}: {
  issueNumber: number;
  variant?: "secondary" | "link";
  full?: boolean;
}) {
  const pdf = useIssuePdf(issueNumber);
  const link = variant === "link";
  const label =
    pdf.state === "loading"
      ? "Preparing…"
      : pdf.state === "error"
        ? "Retry PDF"
        : link
          ? "PDF"
          : "Download PDF";

  return (
    <Button
      variant={variant}
      full={full}
      onClick={pdf.download}
      busy={pdf.state === "loading"}
      aria-label={
        pdf.state === "error"
          ? `PDF failed — tap to retry (issue ${issueNumber})`
          : `Download PDF of issue ${issueNumber}`
      }
    >
      <span className="inline-flex items-center gap-2">
        {label}
        {pdf.state === "loading" ? (
          <span
            aria-hidden="true"
            className="h-[17px] w-[17px] animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
          />
        ) : (
          !link && <Icon name="download" size={17} strokeWidth={1.8} />
        )}
      </span>
    </Button>
  );
}
