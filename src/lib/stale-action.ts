import { unstable_isUnrecognizedActionError } from "next/navigation";

// A page open across a deploy calls a Server Action the new build no longer
// has (#401). Expected after every release: never reported, and only a full
// reload (not a retry, which keeps the stale bundle) recovers. This is the only
// place that asks Next.js; every catch of a Server Action call goes through it.
export function isStaleAction(error: unknown): boolean {
  // Annotated: as a bare type guard it narrows the caller's `error` to never.
  const stale: boolean = unstable_isUnrecognizedActionError(error);
  return stale;
}

// The wording of the full-page state (#402) and the inline notice (#403).
export const STALE_KICKER = "The site has been updated";
export const STALE_TITLE = "Please reload this page.";
export const STALE_BODY =
  "A new version went live while this page was open, so what you just did wasn’t saved. Reload the page and do it again.";
export const STALE_NOTICE =
  "A new version went live while this page was open, so that wasn’t saved. Reload the page and do it again.";
// Where words are being typed: reloading clears the box.
export const STALE_NOTICE_TYPED =
  "A new version went live while this page was open, so that wasn’t saved. Copy what you wrote, reload the page, then do it again.";
// Where the words were kept for the reload (#132).
export const STALE_NOTICE_KEPT =
  "A new version went live while this page was open, so that wasn’t saved. Reload the page and send it again — what you wrote will still be there.";
// Said once, after the reload, beside the box it went back into.
export const draftRestored = (button: string) =>
  `We kept what you were writing — press ${button} to send it.`;

export const RELOAD_LABEL = "Reload page";

export type Failure = { ok: false; reason: string; stale?: true };

// A caught Server Action rejection as the `{ ok: false, reason }` the
// discussion callbacks return; `stale` tells the caller to show the reload
// notice rather than the reason.
export function failureFrom(
  error: unknown,
  fallback = "That didn’t go through. Please try again.",
): Failure {
  return isStaleAction(error)
    ? { ok: false, reason: STALE_NOTICE, stale: true }
    : { ok: false, reason: fallback };
}
