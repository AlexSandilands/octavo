// The chat route's contract with the editor panel (#308/#309): body limits,
// where the projection travels, and the failure copy. Client-safe; the full
// write-up is docs/ai-assistant.md → "The chat route".

export const AI_CHAT_PATH = "/api/admin/ai/chat";

// The fresh projection rides in the author's message as a data part, before the
// text part. It stays in history verbatim, so the cache prefix never changes.
export const AI_PROJECTION_PART = "data-projection";
export type AiProjectionData = { text: string };

export const AI_MAX_MESSAGES = 200;
export const AI_MAX_TEXT_CHARS = 20_000;
export const AI_MAX_PROJECTION_CHARS = 60_000;
export const AI_MAX_IMAGES_PER_MESSAGE = 8;
// Past these the conversation is full (`too_long`). Sized to a 200k-token
// context: 330k chars at ~3 chars/token is 110k, 24 images at ~1.6k tokens is
// 38k, plus the prompt (~5k) and the reply (32k) leaves ~15k spare.
export const AI_MAX_IMAGES_PER_REQUEST = 24;
export const AI_MAX_CONVERSATION_CHARS = 330_000;
export const AI_MAX_OUTPUT_TOKENS = 32_000;
export const AI_MAX_BODY_BYTES = 24 * 1024 * 1024;

export const AI_ERROR_CODES = [
  "unauthorised",
  "bad_request",
  "not_found",
  "not_draft",
  "too_long",
  "rate_limited",
  "budget_spent",
  "run_cap",
  "provider_down",
  "provider_busy",
] as const;
export type AiErrorCode = (typeof AI_ERROR_CODES)[number];
export type AiError = { error: string; code: AiErrorCode };

// Shown to the author verbatim, so plain words and no jargon.
export const AI_ERROR_COPY: Record<AiErrorCode, string> = {
  unauthorised: "Only an admin who is signed in can use the assistant.",
  bad_request:
    "The assistant couldn't read that request. Reload the editor and try again.",
  not_found: "This issue couldn't be found. It may have been deleted.",
  not_draft:
    "The assistant only works on drafts. This issue has been published.",
  too_long:
    "This conversation has grown too long for the assistant. Start a new one to carry on.",
  rate_limited:
    "The assistant has been asked a lot in the last few minutes. Wait a few minutes and try again.",
  budget_spent:
    "This month's assistant allowance has been used up. It starts again next month, or the site owner can add more.",
  run_cap:
    "This request has used its share of the budget; what it did so far is kept and undoable.",
  provider_down:
    "The assistant's service isn't answering right now. Nothing more was changed; try again in a few minutes.",
  provider_busy:
    "The assistant's service is busy right now. Wait a minute and try again.",
};

/**
 * Reads the error useChat reports. The route answers every failure with
 * `{ error, code }` JSON, before the stream (as the response body) or during
 * it (as the stream's error text); either way it arrives as `error.message`.
 */
export function readAiError(message: string | undefined): AiError {
  try {
    const parsed = JSON.parse(message ?? "") as Partial<AiError>;
    if (
      typeof parsed.error === "string" &&
      AI_ERROR_CODES.includes(parsed.code as AiErrorCode)
    )
      return { error: parsed.error, code: parsed.code as AiErrorCode };
  } catch {}
  return { error: AI_ERROR_COPY.provider_down, code: "provider_down" };
}
