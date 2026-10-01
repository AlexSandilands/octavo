import "server-only";
import { APICallError, RetryError } from "ai";
import { NextResponse } from "next/server";
import {
  AI_ERROR_COPY,
  type AiError,
  type AiErrorCode,
} from "@/lib/ai-chat-contract";

// The chat route's failures (#308): one `{ error, code }` shape before the
// stream (a JSON response) and during it (the stream's error text).

const STATUS: Record<AiErrorCode, number> = {
  unauthorised: 403,
  bad_request: 400,
  not_found: 404,
  not_draft: 409,
  too_long: 413,
  rate_limited: 429,
  budget_spent: 402,
  run_cap: 402,
  provider_down: 502,
  provider_busy: 503,
};

export const aiError = (code: AiErrorCode): AiError => ({
  error: AI_ERROR_COPY[code],
  code,
});

export function aiErrorResponse(
  code: AiErrorCode,
  headers?: Record<string, string>,
): NextResponse {
  return NextResponse.json(aiError(code), { status: STATUS[code], headers });
}

/** Which failure a provider error is, in the panel's terms. */
export function classifyProviderError(error: unknown): AiErrorCode {
  const cause = RetryError.isInstance(error) ? error.lastError : error;
  if (APICallError.isInstance(cause)) {
    // 529 is Anthropic's "overloaded".
    if (cause.statusCode === 429 || cause.statusCode === 529)
      return "provider_busy";
    if (
      cause.statusCode === 400 &&
      /too long|context length|context window/i.test(cause.message)
    )
      return "too_long";
  }
  return "provider_down";
}
