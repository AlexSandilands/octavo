import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import {
  AI_RENDER_MAX_BYTES,
  aiRenderRequestSchema,
  type AiRenderResponse,
} from "@/lib/ai-vision-contract";
import { createRateLimiter } from "@/lib/rate-limit";
import { readDraftRequest } from "@/server/ai-render/admin-request";
import {
  ChromiumUnavailableError,
  renderDraftPages,
} from "@/server/ai-render/render-pages";
import { takeRenderSlot } from "@/server/ai-render/slots";
import { dropDraft, stashDraft } from "@/server/ai-render/stash";

// Pictures of a draft's pages for the assistant (#342): `view_page` and the
// end-of-run review. The body is the issue as the editor holds it — unsaved
// edits must show — validated whole by the save path's schema. It is printed
// by the PDF's own PrintDocument in headless Chromium (server/ai-render), so the
// model sees what members will. Drafts only; each picture costs a Chromium run,
// so it is limited per admin (a run takes at most 6 views and one review) and
// to two renders at once across the instance (server/ai-render/slots).
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const limiter = createRateLimiter({ limit: 120, windowMs: 10 * 60_000 });

export async function POST(request: Request) {
  const req = await readDraftRequest(request, {
    schema: aiRenderRequestSchema,
    maxBytes: AI_RENDER_MAX_BYTES,
    limiter,
  });
  if (!req.ok) return req.response;
  const { issueId, theme, logoId, content, pages } = req.data;
  const release = takeRenderSlot();
  if (!release)
    return NextResponse.json(
      {
        error: "Too many pages are being pictured at once. Try again shortly.",
      },
      { status: 503, headers: { "Retry-After": "5" } },
    );

  const nonce = stashDraft({ issueId, theme, logoId, content });
  try {
    const rendered = await renderDraftPages(
      nonce,
      pages.map((page) => ({
        page,
        cover: Boolean(content.pages[page - 1]?.cover),
      })),
    );
    const body: AiRenderResponse = { pages: rendered };
    return NextResponse.json(body, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    if (!(error instanceof ChromiumUnavailableError))
      Sentry.captureException(error, { tags: { area: "ai-render" } });
    console.error(`Assistant page render failed for issue ${issueId}`, error);
    return NextResponse.json(
      { error: "The page couldn't be pictured just now." },
      { status: 500 },
    );
  } finally {
    dropDraft(nonce);
    release();
  }
}
