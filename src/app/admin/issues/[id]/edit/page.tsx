import { notFound } from "next/navigation";
import { Editor } from "@/features/editor/editor";
import { getIssue } from "@/server/issues";
import { resolveIssueImages } from "@/server/images";
import { countSubscribedRecipients } from "@/server/recipients";
import { requireAdminOrRedirect } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function EditIssuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminOrRedirect(); // layout gates too; not re-run on soft nav
  const { id } = await params;
  const issue = await getIssue(id);
  if (!issue) notFound();

  const [images, subscriberCount] = await Promise.all([
    resolveIssueImages(issue.content),
    countSubscribedRecipients(),
  ]);

  return (
    <Editor
      issue={{
        id: issue.id,
        number: issue.number,
        title: issue.title,
        theme: issue.theme,
        content: issue.content,
        revision: issue.revision,
        status: issue.status,
      }}
      images={images}
      subscriberCount={subscriberCount}
    />
  );
}
