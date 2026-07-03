import { notFound } from "next/navigation";
import { DesktopReader } from "@/features/reader/desktop-reader";
import { MobileReader } from "@/features/reader/mobile-reader";
import { getPublishedIssueByNumber } from "@/server/issues";
import { resolveIssueImages } from "@/server/images";
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

  const images = await resolveIssueImages(issue.content);

  return (
    <>
      <div className="hidden md:block">
        <DesktopReader
          content={issue.content}
          issueNo={issue.number}
          images={images}
        />
      </div>
      <div className="md:hidden">
        <MobileReader content={issue.content} images={images} />
      </div>
    </>
  );
}
