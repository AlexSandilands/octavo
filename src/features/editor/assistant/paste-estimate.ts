import { priceFor } from "@/lib/ai-pricing";

// What a long paste will cost to lay out (#312), shown before it is sent.
// Fitted to Sonnet 5's real case-08 and case-14 runs (2026-09-28): almost
// every token is a cache write or read, and the plan's arguments repeat the
// paste as output (thinking included). The run's own cost is a cold prompt,
// tools and projection plus its tool results; the paste is written twice (the
// message, then the plan in history) and read by each later turn; the
// end-of-run review adds a picture of each page written, at most 8.

/** Messages longer than this ask first. */
export const CONFIRM_FROM_CHARS = 4_000;

const CHARS_PER_TOKEN = 4;
/** The plan's arguments: the paste as JSON, with its field names and escapes. */
const PLAN_OUTPUT_PER_PASTE_TOKEN = 1.3;
const LATER_TURNS = 4;
const RUN = { cacheWrite: 20_000, cacheRead: 60_000, output: 1_500 };
/** One page as the review sees it (960×1350), and the text a page holds. */
const REVIEW = { tokensPerPage: 1_750, charsPerPage: 2_500, maxPages: 8 };

/** A message of this many characters asks before it is sent. */
export const needsCostConfirm = (chars: number) => chars > CONFIRM_FROM_CHARS;

/** US dollars to lay out `chars` of pasted text on `model`; null if unpriced. */
export function estimatePasteUsd(chars: number, model: string): number | null {
  const price = priceFor(model);
  if (!price) return null;
  const paste = Math.ceil(chars / CHARS_PER_TOKEN);
  const pages = Math.min(
    REVIEW.maxPages,
    Math.ceil(chars / REVIEW.charsPerPage) + 1,
  );
  const review = pages * REVIEW.tokensPerPage;
  const micros =
    (RUN.cacheWrite + 2 * paste + review) * price.cacheWritePerMillion +
    (RUN.cacheRead + 2 * LATER_TURNS * paste + review) *
      price.cacheReadPerMillion +
    (RUN.output + PLAN_OUTPUT_PER_PASTE_TOKEN * paste) * price.outputPerMillion;
  return micros / 1_000_000;
}
