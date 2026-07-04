import { notFound } from "next/navigation";
import { ReaderMount } from "@/features/reader/reader-mount";
import { getPublishedIssueByNumber } from "@/server/issues";
import { resolveIssueImages } from "@/server/images";
import { resolveIssueSponsors } from "@/server/sponsors";
import { requireMemberOrRedirect } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function ReadPage({
  params,
}: {
  params: Promise<{ issueId: string }>;
}) {
  const { issueId } = await params;
  // Members only; the destination rides along so the emailed link brings a
  // signed-out member straight back to this issue.
  await requireMemberOrRedirect(`/read/${issueId}`);
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
    <ReaderMount
      content={issue.content}
      issueNo={issue.number}
      images={images}
      sponsors={sponsors}
    />
  );
}
