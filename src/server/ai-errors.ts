import "server-only";
import {
  APICallError,
  InvalidToolInputError,
  NoSuchToolError,
  RetryError,
} from "ai";
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

/** A call refused before it ran (bad input, no such tool), worded for the
 *  model so it corrects the call rather than reading an outage; else null.
 *  The SDK hands a tool part's error over as its message string, which holds
 *  the whole input, so only the tool's name and the schema's issues are kept. */
export function toolCallErrorText(error: unknown): string | null {
  const message = typeof error === "string" ? error : null;
  const missing = NoSuchToolError.isInstance(error)
    ? error.toolName
    : message?.match(
        /^(?:AI_\w+: )?Model tried to call unavailable tool '([^']+)'/,
      )?.[1];
  if (missing)
    return `There is no tool called "${missing}". Nothing was changed.`;
  const tool = InvalidToolInputError.isInstance(error)
    ? error.toolName
    : message?.match(/^(?:AI_\w+: )?Invalid input for tool ([\w-]+):/)?.[1];
  if (!tool) return null;
  const issues = (message ? issuesIn(message) : causeIssues(error))
    .slice(0, 6)
    .map((i) => `${i.path?.join(".") || "input"}: ${i.message}`);
  return `The ${tool} call was refused, and nothing was changed: ${
    issues.length
      ? issues.join("; ")
      : "its input doesn't match the tool's schema"
  }. Correct the input and call it again.`;
}

type Issue = { path?: (string | number)[]; message: string };

/** The schema's issues, from wherever in the error's causes they are. */
function causeIssues(error: unknown): Issue[] {
  for (let e = error, depth = 0; e && depth < 5; depth++) {
    const issues = (e as { issues?: unknown }).issues;
    if (Array.isArray(issues)) return issues as Issue[];
    e = (e as { cause?: unknown }).cause;
  }
  return [];
}

/** The issues the message ends with ("… Error message: [ … ]"), if it does. */
function issuesIn(message: string): Issue[] {
  const at = message.lastIndexOf("Error message: ");
  if (at < 0) return [];
  try {
    const issues: unknown = JSON.parse(message.slice(at + 15));
    return Array.isArray(issues) ? (issues as Issue[]) : [];
  } catch {
    return [];
  }
}
