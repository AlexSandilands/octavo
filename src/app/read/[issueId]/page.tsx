import { notFound } from "next/navigation";
import { DesktopReader } from "@/features/reader/desktop-reader";
import { MobileReader } from "@/features/reader/mobile-reader";
import { getPublishedIssueByNumber } from "@/server/issues";

export const dynamic = "force-dynamic";

export default async function ReadPage({
  params,
}: {
  params: Promise<{ issueId: string }>;
}) {
  const { issueId } = await params;
  const number = Number(issueId);
  const issue = Number.isFinite(number)
    ? await getPublishedIssueByNumber(number)
    : null;
  if (!issue) notFound();

  return (
    <>
      <div className="hidden md:block">
        <DesktopReader content={issue.content} issueNo={issue.number} />
      </div>
      <div className="md:hidden">
        <MobileReader content={issue.content} />
      </div>
    </>
  );
}
