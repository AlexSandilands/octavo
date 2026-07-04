import { notFound } from "next/navigation";
import { PrintDocument } from "@/features/reader/print-document";
import { getPublishedIssueByNumber } from "@/server/issues";
import { resolveIssueImages } from "@/server/images";
import { resolveIssueSponsors } from "@/server/sponsors";
import { verifyPrintToken } from "@/lib/pdf-token";

// The print view the PDF generator loads (src/lib/pdf.ts) over localhost. It is
// NOT session-gated — the edge auth gate lets `/print` through so the cookie-
// less generator can reach it — so the internal print token is the only guard:
// a request without a valid token is indistinguishable from a missing page
// (404). That keeps the route unreachable from outside even though the reader
// is members-only; it never exposes anything a member couldn't already read.
export const dynamic = "force-dynamic";

export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ issueId: string }>;
  searchParams: Promise<{ token?: string; theme?: string }>;
}) {
  const { token, theme } = await searchParams;
  if (!verifyPrintToken(token)) notFound();

  const { issueId } = await params;
  const number = Number(issueId);
  const issue = Number.isFinite(number)
    ? await getPublishedIssueByNumber(number)
    : null;
  if (!issue) notFound();

  const [images, sponsors] = await Promise.all([
    resolveIssueImages(issue.content),
    resolveIssueSponsors(issue.content),
  ]);

  return (
    <PrintDocument
      content={issue.content}
      issueNo={issue.number}
      // The reader's theme is a member-facing toggle (client state, not stored
      // on the issue), so the generator forwards the selection here; the
      // download endpoint validated it. Anything else falls back to the
      // reader's default.
      theme={theme === "modern" ? "modern" : "classic"}
      images={images}
      sponsors={sponsors}
    />
  );
}
