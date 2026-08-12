import { notFound } from "next/navigation";
import { PrintDocument } from "@/features/reader/print-document";
import { getPublishedIssueByNumber } from "@/server/issues";
import { resolveIssueImages } from "@/server/images";
import { getLogoImage } from "@/server/logos";
import { resolveIssueSponsors, sponsorFingerprint } from "@/server/sponsors";
import { chromeFingerprint, getSettings } from "@/server/settings";
import { settingsForIssue } from "@/lib/branding";
import { verifyPrintToken } from "@/lib/pdf-token";

// The print view the PDF generator loads (src/lib/pdf.ts) over localhost. It is
// NOT session-gated — the edge auth gate lets `/print` through so the cookie-
// less generator can reach it — so the internal print token is the only guard:
// a request without a valid token is indistinguishable from a missing page
// (404). That keeps the route unreachable from outside even though the reader
// is members-only; it never exposes anything a member couldn't already read.
export const dynamic = "force-dynamic";

export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ issueId: string }>;
  searchParams: Promise<{ token?: string; theme?: string }>;
}) {
  const { token, theme } = await searchParams;
  if (!verifyPrintToken(token)) notFound();

  const { issueId } = await params;
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

  // The magazine's settings with the footer held to this issue's reserve
  // (issue #128) — the resolution this page prints with, and the same one the
  // download endpoint fingerprinted for the cache key. Resolved once here so
  // the stamp below and the document below it cannot describe different things.
  const printSettings = settingsForIssue(settings, issue);

  return (
    <>
      {/* The chrome fingerprint of the settings THIS request resolved, stamped
          into the document so the generator can check it before printing.
          The download endpoint read settings in its own request and named them
          in the cache key it will store these bytes under; a settings edit
          landing in between, or a database blip degrading getSettings() here to
          the deployment defaults (server/settings.ts), would print branding
          that key doesn't describe — and every member would be served those
          wrong bytes for that revision until the next edit re-keyed past them
          (issue #127). The generator compares and refuses to store a mismatch;
          see generateIssuePdf. React hoists this into <head>, so it costs the
          printed page nothing. */}
      <meta name="print-chrome" content={chromeFingerprint(printSettings)} />
      {/* The same guarantee for the sponsors this request resolved (issue
          #180). Sponsor names, links and logos live in the `sponsors` table,
          not in `content`, so a sponsor edited or deleted between the
          endpoint's read and this one would print a card its key doesn't
          describe — and a deleted sponsor would go on advertising in every
          member's copy. Fingerprinted from the very map handed to
          PrintDocument below, so the stamp cannot describe a different set of
          sponsors than the pages do. */}
      <meta
        name="print-sponsors"
        content={sponsorFingerprint(issue.content, sponsors)}
      />
      <PrintDocument
        content={issue.content}
        issueNo={issue.number}
        // The reader's theme is a member-facing toggle (client state, not stored
        // on the issue), so the generator forwards the selection here; the
        // download endpoint validated it against the registry. PrintDocument
        // resolves it and degrades anything unknown to the reader's default.
        theme={typeof theme === "string" ? theme : ""}
        logo={logo}
        settings={printSettings}
        images={images}
        sponsors={sponsors}
      />
    </>
  );
}
