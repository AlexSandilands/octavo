import { z } from "zod";

// The assistant's suggested next message (#366). A reply that offers something
// ends with one line, `[[next: <label> | <message>]]` (the shape base.md
// teaches), which the panel shows as a button and as a ghost in the composer.
// The line is dropped from the reply as the author reads it, never from the
// history. Anything that isn't short plain text is ignored, silently.

export const FOLLOW_UP_OPEN = "[[next:";
export const FOLLOW_UP_CLOSE = "]]";
export const FOLLOW_UP_LABEL_MAX = 24;
export const FOLLOW_UP_MESSAGE_MAX = 200;

/** No links, addresses, markup or block-id brackets: words only. */
const plain = (s: string) =>
  !/[[\]<>{}\n\r`]|:\/\/|www\.|mailto:|\S@\S/i.test(s);
const followUpSchema = z.object({
  label: z.string().min(1).max(FOLLOW_UP_LABEL_MAX).refine(plain),
  message: z.string().min(1).max(FOLLOW_UP_MESSAGE_MAX).refine(plain),
});
export type FollowUp = z.infer<typeof followUpSchema>;

/**
 * A reply as the author reads it, and its suggestion if it ends with a valid
 * one. A marker still streaming in (or malformed) is dropped all the same, so
 * the brackets never flash up in the thread.
 */
export function splitFollowUp(text: string): {
  body: string;
  followUp: FollowUp | null;
} {
  const end = text.trimEnd();
  const at = end.lastIndexOf(FOLLOW_UP_OPEN);
  const tail = at >= 0 ? end.slice(at) : partialOpen(end);
  if (tail === null || tail.includes("\n"))
    return { body: text, followUp: null };
  const body = end.slice(0, end.length - tail.length).trimEnd();
  if (!tail.startsWith(FOLLOW_UP_OPEN) || !tail.endsWith(FOLLOW_UP_CLOSE))
    return { body, followUp: null };
  const inner = tail.slice(FOLLOW_UP_OPEN.length, -FOLLOW_UP_CLOSE.length);
  const bar = inner.indexOf("|");
  if (bar < 0) return { body, followUp: null };
  const parsed = followUpSchema.safeParse({
    label: inner.slice(0, bar).trim(),
    message: inner.slice(bar + 1).trim(),
  });
  return { body, followUp: parsed.success ? parsed.data : null };
}

/** The start of a marker at the very end, mid-stream ("[[ne"). */
function partialOpen(text: string): string | null {
  for (let n = FOLLOW_UP_OPEN.length - 1; n >= 2; n--)
    if (text.endsWith(FOLLOW_UP_OPEN.slice(0, n))) return text.slice(-n);
  return null;
}

/** A reply without its suggestion line, for anything that reads its words. */
export const withoutFollowUp = (text: string) => splitFollowUp(text).body;
