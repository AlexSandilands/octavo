import { notFound } from "next/navigation";
import { Editor } from "@/features/editor/editor";
import { EditorGate } from "@/features/editor/editor-gate";
import { getIssue, nextIssueNumber } from "@/server/issues";
import { resolveIssueImages } from "@/server/images";
import { listLogos } from "@/server/logos";
import { countSubscribedRecipients } from "@/server/recipients";
import { listSponsors } from "@/server/sponsors";
import { requireAdminOrRedirect } from "@/server/session";
import { getSettings } from "@/server/settings";
import { settingsForIssue } from "@/lib/branding";

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

  // The full sponsor list feeds the editor's block picker; the editor also
  // derives the render map from it, so one query covers both. The logo list
  // does the same double duty for the footer mark: it is the picker's options
  // *and* how the canvas resolves the current choice to an image.
  const [images, sponsors, logos, settings, subscriberCount, suggestedNumber] =
    await Promise.all([
      resolveIssueImages(issue.content),
      listSponsors(),
      listLogos(),
      getSettings(),
      countSubscribedRecipients(),
      nextIssueNumber(),
    ]);

  return (
    <EditorGate>
      <Editor
        issue={{
          id: issue.id,
          number: issue.number,
          title: issue.title,
          theme: issue.theme,
          logoId: issue.logoId,
          content: issue.content,
          revision: issue.revision,
          status: issue.status,
          footerMarkSize: issue.footerMarkSize,
          footerTextSize: issue.footerTextSize,
        }}
        // A draft has no number of its own (issue #270), but the classic
        // running head needs one to preview; this is what publishing would
        // propose. Nothing is stored until the admin confirms it.
        suggestedNumber={suggestedNumber}
        images={images}
        sponsors={sponsors}
        logos={logos}
        // The canvas draws — and measures overflow against — the footer this
        // issue's pages were laid out for (issue #128), which is what the reader
        // gets. `magazineFooter` is the unclamped setting, so the editor can
        // offer to bring the issue up to it.
        settings={settingsForIssue(settings, issue)}
        magazineFooter={settings.footer}
        subscriberCount={subscriberCount}
      />
    </EditorGate>
  );
}
