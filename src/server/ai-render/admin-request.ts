import "server-only";
import type { NextResponse } from "next/server";
import type { z } from "zod";
import { isAssistantEnabled } from "@/lib/ai";
import { readBoundedBody } from "@/lib/bounded-body";
import type { RateLimiter } from "@/lib/rate-limit";
import { sameOrigin } from "@/lib/same-origin";
import { aiErrorResponse } from "@/server/ai-errors";
import { getIssue } from "@/server/issues";
import { getAdminUser } from "@/server/session";

// The gate the assistant's picture routes share (#342), in the chat route's
// order: same origin and an admin (403), off → an empty 404, the per-admin
// limit (429), a JSON body under the cap, the route's zod, and a draft to look
// at (404 / 409). Every refusal is the chat route's `{ error, code }` JSON.

type Refused = { ok: false; response: NextResponse | Response };
type Accepted<T> = {
  ok: true;
  data: T;
  issue: NonNullable<Awaited<ReturnType<typeof getIssue>>>;
};

export async function readDraftRequest<
  S extends z.ZodType<{ issueId: string }, z.ZodTypeDef, unknown>,
>(
  request: Request,
  {
    schema,
    maxBytes,
    limiter,
  }: { schema: S; maxBytes: number; limiter: RateLimiter },
): Promise<Accepted<z.output<S>> | Refused> {
  const refuse = (response: NextResponse | Response): Refused => ({
    ok: false,
    response,
  });
  const admin = sameOrigin(request) ? await getAdminUser() : null;
  if (!admin) return refuse(aiErrorResponse("unauthorised"));
  if (!isAssistantEnabled()) return refuse(new Response(null, { status: 404 }));
  const rate = limiter.check(admin.id);
  if (!rate.ok)
    return refuse(
      aiErrorResponse("rate_limited", {
        "Retry-After": String(rate.retryAfterSeconds),
      }),
    );
  const type = request.headers.get("content-type")?.split(";")[0]?.trim();
  if (type?.toLowerCase() !== "application/json")
    return refuse(aiErrorResponse("bad_request"));
  const body = await readBoundedBody(request, maxBytes);
  if (!body.ok)
    return refuse(
      aiErrorResponse(body.reason === "too-large" ? "too_long" : "bad_request"),
    );
  let raw: unknown;
  try {
    raw = JSON.parse(body.bytes.toString("utf8"));
  } catch {
    return refuse(aiErrorResponse("bad_request"));
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return refuse(aiErrorResponse("bad_request"));
  const issue = await getIssue(parsed.data.issueId);
  if (!issue) return refuse(aiErrorResponse("not_found"));
  if (issue.status !== "draft") return refuse(aiErrorResponse("not_draft"));
  return { ok: true, data: parsed.data, issue };
}
