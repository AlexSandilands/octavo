import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_MODE } from "@/lib/demo";
import { site } from "@/lib/site";
import { getObject, putObject } from "@/lib/storage";
import {
  ChromiumUnavailableError,
  generateIssuePdf,
  type PdfTheme,
} from "@/lib/pdf";
import { DEFAULT_THEME_ID, THEME_IDS } from "@/features/blocks/themes/registry";
import { getPublishedIssueByNumber } from "@/server/issues";
import { getUserFailClosed } from "@/server/session";

// Members-only PDF download. The reader is gated, so this is too: a signed-out
// request is refused. Demo mode (issue #50) ungates the reader, so this
// follows it — the download is part of the showcase, and the R2 cache keeps
// the anonymous generation cost bounded (one Chromium run per revision+theme).
//
// The PDF is a derived artifact cached in R2 keyed by issue
// id + revision + theme + render version
// (`pdfs/{issueId}/{revision}-{theme}-v{RENDER_VERSION}.pdf`) — a cache hit
// serves the stored bytes; a miss generates once via Playwright, stores, and
// serves. Since `revision` bumps on every content write (and RENDER_VERSION on
// renderer changes), editing + republishing yields a new key and a fresh PDF
// with no manual invalidation (design-principles §4).
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
): Promise<Buffer> {
  const existing = inFlight.get(key);
  if (existing) return existing;
  const task = (async () => {
    const pdf = await generateIssuePdf(issueNumber, theme);
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
// with the old rendering bug. v2: trailing-blank-page fix.
const RENDER_VERSION = 2;

// A download filename the browser and the audience can read. Strip anything
// path- or header-unsafe; keep an ASCII fallback plus a UTF-8 form for clients
// that honour RFC 5987.
function contentDisposition(issueNumber: number): string {
  const base = `${site.name} No. ${issueNumber}`;
  const ascii = base.replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "");
  const safe = (ascii || `Issue ${issueNumber}`).trim();
  return `attachment; filename="${safe}.pdf"; filename*=UTF-8''${encodeURIComponent(base)}.pdf`;
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

  const key = `pdfs/${issue.id}/${issue.revision}-${theme}-v${RENDER_VERSION}.pdf`;

  let pdf: Buffer | null;
  try {
    pdf = await getObject(key);
    if (!pdf) pdf = await generateOnce(key, number, theme);
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
      "Content-Disposition": contentDisposition(number),
      // Always revalidate against the endpoint so a republish (new revision) is
      // never masked by a cached download.
      "Cache-Control": "private, no-store",
    },
  });
}
