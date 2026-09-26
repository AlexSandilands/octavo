import { priceFor } from "@/lib/ai-pricing";

// What a long paste will cost to lay out (#312), shown before it is sent. The
// paste goes in once (a cache write), comes back once as the model's plan
// (output), and is read from cache by each later turn: the plan's result, the
// end-of-run review and the reply. On top is a run's own cost: the prompt and
// projection read from cache, a little uncached input, the replies.

/** Messages longer than this ask first. */
export const CONFIRM_FROM_CHARS = 4_000;

const CHARS_PER_TOKEN = 4;
const LATER_TURNS = 3;
const RUN = { input: 8_000, cacheRead: 60_000, output: 2_000 };

/** A message of this size asks before it is sent. #343 adds its attachments' text. */
export const needsCostConfirm = (chars: number) => chars > CONFIRM_FROM_CHARS;

/** US dollars to lay out `chars` of pasted text on `model`; null if unpriced. */
export function estimatePasteUsd(chars: number, model: string): number | null {
  const price = priceFor(model);
  if (!price) return null;
  const paste = Math.ceil(chars / CHARS_PER_TOKEN);
  const micros =
    RUN.input * price.inputPerMillion +
    paste * price.cacheWritePerMillion +
    (RUN.cacheRead + LATER_TURNS * paste) * price.cacheReadPerMillion +
    (RUN.output + paste) * price.outputPerMillion;
  return micros / 1_000_000;
}
