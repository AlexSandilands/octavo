import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_MODE } from "@/lib/demo";
import { getObject, putObject } from "@/lib/storage";
import {
  ChromiumUnavailableError,
  generateIssuePdf,
  type PdfTheme,
} from "@/lib/pdf";
import { DEFAULT_THEME_ID, THEME_IDS } from "@/features/blocks/themes/registry";
import { getPublishedIssueByNumber } from "@/server/issues";
import { getUserFailClosed } from "@/server/session";
import { chromeFingerprint, getSettings } from "@/server/settings";
import { settingsForIssue } from "@/lib/branding";

// Members-only PDF download. The reader is gated, so this is too: a signed-out
// request is refused. Demo mode (issue #50) ungates the reader, so this
// follows it — the download is part of the showcase, and the R2 cache keeps
// the anonymous generation cost bounded (one Chromium run per revision+theme).
//
// The PDF is a derived artifact cached in R2 keyed by every input that changes
// what it looks like: issue id + revision + theme + footer logo + magazine
// chrome + render version
// (`pdfs/{issueId}/{revision}-{theme}-{logo}-{chrome}-v{RENDER_VERSION}.pdf`) —
// a cache hit serves the stored bytes; a miss generates once via Playwright,
// stores, and serves. Since `revision` bumps on every content write (and
// RENDER_VERSION on renderer changes), editing + republishing yields a new key
// and a fresh PDF with no manual invalidation (design-principles §4).
//
// Two of those segments are *render* inputs living outside `content`, so
// neither bumps `revision`; without them a re-download would keep serving a
// stale document:
//   - the logo: swapping the issue's mark is a meta save (issue #97).
//   - the chrome fingerprint: a short hash of the branding + footer appearance
//     the owner edits at /admin/magazine (issue #105), baked into every printed
//     page (classic running head, footer name, footer lockup). See
//     chromeFingerprint() for exactly what it does and does not cover.
//
// The bytes are proxied through this endpoint rather than served from a public
// URL: unlike images, a whole-issue PDF stays behind the member gate.

export const dynamic = "force-dynamic";

// Coalesce concurrent generations of the same key within one instance, so the
// first hit after a publish (which several members might click at once) launches
// one Chromium, not one per request. Cleared when the generation settles.
const inFlight = new Map<string, Promise<Buffer>>();

function generateOnce(
  key: string,
  issueNumber: number,
  theme: PdfTheme,
  chrome: string,
): Promise<Buffer> {
  const existing = inFlight.get(key);
  if (existing) return existing;
  const task = (async () => {
    const pdf = await generateIssuePdf(issueNumber, theme, chrome);
    await putObject(key, pdf, "application/pdf");
    return pdf;
  })();
  inFlight.set(key, task);
  return task.finally(() => inFlight.delete(key));
}

// The reader theme the PDF should render in. The desktop reader sends its
// current selection (the theme toggle is client state, not stored on the
// issue); callers without a theme concept (mobile reader, latest-issue card)
// send none and get the reader's default. Part of the cache key: each theme is
// its own derived artifact. Derived from the layout-theme registry, so a new
// theme is accepted here with no edit (issue #40).
const themeSchema = z
  .enum(THEME_IDS as [PdfTheme, ...PdfTheme[]])
  .default(DEFAULT_THEME_ID);

// Cache-busts every stored PDF when the *renderer* changes, the counterpart of
// `revision` busting on content changes. Bump it in the same commit as any
// print-rendering fix (print document, PageBlocks/BlockView output, page.pdf
// options) — otherwise issues whose content didn't change keep serving PDFs
// with the old rendering bug. v2: trailing-blank-page fix. v3: montage blocks
// (issue #95) — a new block type the print document renders, so every cached
// PDF must be rebuilt from the current renderer. v4: the page footer redesign
// (issue #97). v5: the footer's wording and appearance now come from magazine
// settings (issue #105) — the key gained a chrome segment, so this bump is
// belt-and-braces, but the gate for print-visible changes is a blanket rule
// (docs/workflow.md). v6: generation now verifies the print page rendered the
// chrome this key names (issue #127) — any PDF already cached with fallback
// branding under a custom-chrome key is wrong bytes, and only a bump discards
// them. v7: the footer is clamped to the issue's own reserve (issue #128), so
// the chrome segment fingerprints a per-issue resolution rather than the global
// one — the same values on the day it ships (the migration backfilled every
// issue from the settings then in force), but the segment's meaning changed,
// and the blanket rule covers that too.
const RENDER_VERSION = 7;

// Percent-encode for an RFC 8187 ext-value (the `filename*=UTF-8''…` form).
// Only attr-char may appear bare there: ALPHA / DIGIT / "!" / "#" / "$" / "&" /
// "+" / "-" / "." / "^" / "_" / "`" / "|" / "~". encodeURIComponent leaves
// `! ' ( ) * - . _ ~` unescaped, and of those `' ( ) *` are not attr-chars — the
// single quote most of all, since it is the ext-value's own delimiter, so an
// owner-set name like "St John's Gazette" (issue #107) would otherwise produce a
// parameter strict clients reject outright.
function extValue(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

// A download filename the browser and the audience can read. Strip anything
// path- or header-unsafe; keep an ASCII fallback plus a UTF-8 form for clients
// that honour RFC 8187.
function contentDisposition(magazineName: string, issueNumber: number): string {
  const base = `${magazineName} No. ${issueNumber}`;
  // The plain parameter has to be ASCII, and can carry neither quote nor
  // backslash without escaping out of its own quoted-string. Decompose first so
  // accented letters keep their base form ("Kaipātiki" → "Kaipatiki") rather
  // than losing the letter entirely. A name with no ASCII left at all (an
  // all-CJK title, say) would reduce to a bare "No. 4", so name the issue
  // instead.
  const ascii = magazineName
    .normalize("NFD")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/["\\]/g, "")
    .trim();
  const safe = ascii ? `${ascii} No. ${issueNumber}` : `Issue ${issueNumber}`;
  return `attachment; filename="${safe}.pdf"; filename*=UTF-8''${extValue(base)}.pdf`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ number: string }> },
) {
  // Fail closed: any auth error reads as signed out (and is logged there).
  // Demo mode allows anonymous downloads — the reader this derives from is
  // public there too.
  const user = await getUserFailClosed();
  if (!user && !DEMO_MODE) {
    return NextResponse.json(
      { error: "Sign in to download." },
      { status: 403 },
    );
  }

  // The owner can switch downloads off for the whole site (issue #162). Refused
  // here as well as unrendered in the UI, so a saved link, a bookmark or a
  // guessed URL is no way around it. It applies in demo mode too — this is the
  // owner's distribution choice, not an auth gate, and demo mode only ungates
  // the member check above.
  //
  // The internal print route (/read/[id]/print, token-guarded) is deliberately
  // NOT gated: it is how a PDF is produced, and the owner's next issue must
  // still print if they switch downloads back on. Nothing reaches it without
  // the token, so leave it be.
  const settings = await getSettings();
  if (!settings.pdfDownloads) {
    return NextResponse.json(
      { error: "PDF downloads are turned off." },
      { status: 403 },
    );
  }

  const { number: raw } = await params;
  const number = Number(raw);
  if (!Number.isInteger(number) || number <= 0) {
    return NextResponse.json({ error: "Issue not found." }, { status: 404 });
  }

  const issue = await getPublishedIssueByNumber(number);
  if (!issue) {
    return NextResponse.json({ error: "Issue not found." }, { status: 404 });
  }

  const themeParam = themeSchema.safeParse(
    new URL(request.url).searchParams.get("theme") ?? undefined,
  );
  if (!themeParam.success) {
    return NextResponse.json({ error: "Unknown theme." }, { status: 400 });
  }
  const theme = themeParam.data;

  // The print route resolves settings again in its own request, so the two can
  // disagree — an edit landing in between, or a database blip degrading that
  // read to the deployment defaults — and the bytes it prints would be stored
  // under a fingerprint naming values it never rendered. The fingerprint is
  // passed into generation for exactly that reason: the print page stamps what
  // it rendered and the generator refuses to return bytes that don't match, so
  // a mismatch fails here (500, nothing cached) instead of serving every member
  // a wrongly-branded PDF for this revision (issue #127). (`settings` is read
  // above, at the download switch — getSettings is React-`cache()`d, so that is
  // one query either way.)
  //
  // Fingerprint the settings *this issue* prints with — the magazine's, with the
  // footer held to the issue's reserve (issue #128), exactly as the print route
  // will resolve them. A settings change the issue is too full to take therefore
  // leaves the key alone, which is right: the printed page doesn't change
  // either, so the cached bytes are still the correct answer.
  const chrome = chromeFingerprint(settingsForIssue(settings, issue));
  const key = `pdfs/${issue.id}/${issue.revision}-${theme}-${issue.logoId ?? "nologo"}-${chrome}-v${RENDER_VERSION}.pdf`;

  let pdf: Buffer | null;
  try {
    pdf = await getObject(key);
    if (!pdf) pdf = await generateOnce(key, number, theme, chrome);
  } catch (err) {
    // Chromium missing is an operator/deploy problem; a render/storage failure
    // is an infra one. Both are invisible to the member (they see a legible
    // error on the button), so this capture is the only record.
    Sentry.captureException(err, {
      tags: {
        route: "issues/pdf",
        stage:
          err instanceof ChromiumUnavailableError ? "chromium" : "generate",
      },
      extra: { issueNumber: number, revision: issue.revision, theme },
    });
    console.error(`PDF generation failed for issue ${number}`, err);
    return NextResponse.json(
      { error: "Could not build the PDF. Please try again." },
      { status: 500 },
    );
  }

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdf.length),
      "Content-Disposition": contentDisposition(settings.name, number),
      // Always revalidate against the endpoint so a republish (new revision) is
      // never masked by a cached download.
      "Cache-Control": "private, no-store",
    },
  });
}
