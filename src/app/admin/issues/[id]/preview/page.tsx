import Link from "next/link";
import { notFound } from "next/navigation";
import { ReaderMount } from "@/features/reader/reader-mount";
import { getIssue } from "@/server/issues";
import { resolveIssueImages } from "@/server/images";
import { resolveIssueSponsors } from "@/server/sponsors";
import { requireAdminOrRedirect } from "@/server/session";

export const dynamic = "force-dynamic";

// Admin draft preview: renders exactly what members will see, looked up by
// internal id so drafts never need to be reachable at /read (which serves
// published issues only). Lives under /admin so the auth gate covers it.

export default async function PreviewIssuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminOrRedirect(); // layout gates too; not re-run on soft nav
  const { id } = await params;
  const issue = await getIssue(id);
  if (!issue) notFound();

  const [images, sponsors] = await Promise.all([
    resolveIssueImages(issue.content),
    resolveIssueSponsors(issue.content),
  ]);

  return (
    <>
      {issue.status === "draft" && (
        <div className="bg-warn-soft border-line flex items-center justify-center gap-3 border-b px-4 py-2 font-sans text-[13px]">
          <span className="text-warn font-semibold">
            Draft preview — members can’t see this issue yet.
          </span>
          <Link
            href={`/admin/issues/${issue.id}/edit`}
            className="text-warn font-semibold underline underline-offset-[3px]"
          >
            Back to the editor
          </Link>
        </div>
      )}
      {/* Reuse the reader's viewport-split mount (issue #36) so the admin preview
          lazy-loads only the reader its viewport needs, matching /read — instead
          of statically bundling both. */}
      <ReaderMount
        content={issue.content}
        issueNo={issue.number}
        images={images}
        sponsors={sponsors}
      />
    </>
  );
}
