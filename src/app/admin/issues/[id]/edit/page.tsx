import { notFound } from "next/navigation";
import { Editor } from "@/features/editor/editor";
import { getIssue } from "@/server/issues";

export const dynamic = "force-dynamic";

export default async function EditIssuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const issue = await getIssue(id);
  if (!issue) notFound();

  return (
    <Editor
      issue={{
        id: issue.id,
        number: issue.number,
        title: issue.title,
        theme: issue.theme,
        content: issue.content,
      }}
    />
  );
}
