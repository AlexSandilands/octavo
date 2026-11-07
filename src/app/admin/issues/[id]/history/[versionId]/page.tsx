import { notFound } from "next/navigation";
import { z } from "zod";
import { settingsForIssue } from "@/lib/branding";
import { ReaderMount } from "@/features/reader/reader-mount";
import { VersionBanner } from "@/features/editor/history/version-banner";
import { getIssue, nextIssueNumber } from "@/server/issues";
import { getVersion } from "@/server/issue-versions";
import { resolveIssueImages } from "@/server/images";
import { getLogoImage } from "@/server/logos";
import { resolveIssueSponsors } from "@/server/sponsors";
import { requireAdminOrRedirect } from "@/server/session";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

const uuid = z.string().uuid();

// A kept version's pages (aboard #51), read as members would see them, under
// today's title, theme and footer mark — the things a restore leaves alone.
export default async function VersionPreviewPage({
  params,
}: {
  params: Promise<{ id: string; versionId: string }>;
}) {
  await requireAdminOrRedirect();
  const { id, versionId } = await params;
  if (!uuid.safeParse(id).success || !uuid.safeParse(versionId).success) {
    notFound();
  }
  const [issue, version] = await Promise.all([
    getIssue(id),
    getVersion(id, versionId),
  ]);
  if (!issue || !version) notFound();

  const [images, sponsors, logo, settings, suggestedNumber] = await Promise.all(
    [
      resolveIssueImages(version.content),
      resolveIssueSponsors(version.content),
      getLogoImage(issue.logoId),
      getSettings(),
      nextIssueNumber(),
    ],
  );

  return (
    <div className="md:flex md:h-screen md:flex-col md:overflow-hidden">
      <VersionBanner
        issueId={issue.id}
        revision={issue.revision}
        published={issue.status === "published"}
        version={{
          id: version.id,
          savedAt: version.savedAt.toISOString(),
          reason: version.reason,
          pageCount: version.pageCount,
        }}
      />
      <div className="md:min-h-0 md:flex-1">
        <ReaderMount
          content={version.content}
          issueNo={issue.number ?? suggestedNumber}
          logo={logo}
          // The PDF route prints today's pages, never a version's.
          settings={{
            ...settingsForIssue(settings, issue),
            pdfDownloads: false,
          }}
          images={images}
          sponsors={sponsors}
          fillDesktopHeight
        />
      </div>
    </div>
  );
}
