import { notFound } from "next/navigation";
import { DemoBadge } from "@/components/demo-badge";
import { ReaderMount } from "@/features/reader/reader-mount";
import { getPublishedIssueByNumber } from "@/server/issues";
import { resolveIssueImages } from "@/server/images";
import { getLogoImage } from "@/server/logos";
import { resolveIssueSponsors } from "@/server/sponsors";
import { requireMemberOrRedirect } from "@/server/session";
import { getSettings } from "@/server/settings";
import { settingsForIssue } from "@/lib/branding";

export const dynamic = "force-dynamic";

export default async function ReadPage({
  params,
}: {
  params: Promise<{ issueId: string }>;
}) {
  const { issueId } = await params;
  // Members only; the destination rides along so the emailed link brings a
  // signed-out member straight back to this issue. In demo mode the gate
  // returns null instead of redirecting — the reader itself never reads the
  // user, so an anonymous visitor just gets the demo chip overlaid.
  const user = await requireMemberOrRedirect(`/read/${issueId}`);
  const number = Number(issueId);
  const issue = Number.isFinite(number)
    ? await getPublishedIssueByNumber(number)
    : null;
  if (!issue) notFound();

  const [images, sponsors, logo, settings] = await Promise.all([
    resolveIssueImages(issue.content),
    resolveIssueSponsors(issue.content),
    getLogoImage(issue.logoId),
    getSettings(),
  ]);

  return (
    <>
      <ReaderMount
        content={issue.content}
        issueNo={issue.number}
        logo={logo}
        // The footer is held to what this issue's pages were laid out against
        // (issue #128), so a later settings change can't overlap their last
        // lines. Applies to the mobile closer too — one issue, one footer.
        settings={settingsForIssue(settings, issue)}
        images={images}
        sponsors={sponsors}
      />
      {/* Bottom-left stays clear of both readers' chrome (desktop dock is
          bottom-centre, mobile header is top). Decorative overlay only. */}
      {!user && (
        <DemoBadge className="pointer-events-none fixed bottom-4 left-4 z-20" />
      )}
    </>
  );
}
