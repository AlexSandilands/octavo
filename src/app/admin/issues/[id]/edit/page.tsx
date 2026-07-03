import { notFound } from "next/navigation";
import { Editor } from "@/features/editor/editor";
import { getIssue } from "@/server/issues";
import { resolveIssueImages } from "@/server/images";
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

  const images = await resolveIssueImages(issue.content);

  return (
    <Editor
      issue={{
        id: issue.id,
        number: issue.number,
        title: issue.title,
        theme: issue.theme,
        content: issue.content,
        revision: issue.revision,
      }}
      images={images}
    />
  );
}
