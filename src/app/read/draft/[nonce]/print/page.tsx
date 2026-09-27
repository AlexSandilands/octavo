import { notFound } from "next/navigation";
import { PrintDocument } from "@/features/reader/print-document";
import { getIssue, nextIssueNumber } from "@/server/issues";
import { resolveIssueImages } from "@/server/images";
import { getLogoImage } from "@/server/logos";
import { resolveIssueSponsors } from "@/server/sponsors";
import { getSettings } from "@/server/settings";
import { readDraft } from "@/server/ai-render/stash";
import { settingsForIssue } from "@/lib/branding";
import { verifyPrintToken } from "@/lib/pdf-token";

// The assistant's page pictures (#342): a draft as the editor holds it, unsaved
// edits included, printed by the same PrintDocument the PDF uses. Only the
// render route reaches it: it stashes the content under a one-time nonce and
// self-fetches this page with the internal print token, like the PDF generator
// does `/read/[n]/print`. Without both, it is a missing page.
export const dynamic = "force-dynamic";

export default async function DraftPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ nonce: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!verifyPrintToken(token)) notFound();
  const draft = readDraft((await params).nonce);
  const issue = draft ? await getIssue(draft.issueId) : null;
  if (!draft || !issue) notFound();

  const [images, sponsors, logo, settings, suggested] = await Promise.all([
    resolveIssueImages(draft.content),
    resolveIssueSponsors(draft.content),
    getLogoImage(draft.logoId),
    getSettings(),
    issue.number === null ? nextIssueNumber() : Promise.resolve(issue.number),
  ]);

  return (
    <PrintDocument
      content={draft.content}
      // A draft previews the number the editor shows it (issue #270).
      issueNo={suggested}
      theme={draft.theme}
      logo={logo}
      settings={settingsForIssue(settings, issue)}
      images={images}
      sponsors={sponsors}
    />
  );
}
