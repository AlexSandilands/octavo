import type { IssueContent } from "./blocks";
import type { ResolvedImage } from "./images";

// Content v2: sponsor blocks store only a `sponsorId`. To render, the server
// resolves those ids to the managed sponsor's name/href/logo and hands the
// renderers a map — the same pattern as images (see `lib/images.ts`). This file
// holds the framework-agnostic shapes + traversal; the DB lookup lives in
// `server/sponsors.ts`.

// What a renderer needs to draw a referenced sponsor. `href` is the stored,
// unvalidated value (or null); the readers run it through `externalHref` before
// linking, exactly as they do for the inline v1 href.
export type SponsorRef = {
  name: string;
  href: string | null;
  logo: ResolvedImage | null;
};

// sponsorId -> resolved sponsor. A referenced-but-missing sponsor (deleted) has
// no entry, which the renderers treat as "hide the slot" (see BlockView).
export type SponsorMap = Record<string, SponsorRef>;

// The admin-list / editor-picker shape: a full sponsor row with its logo
// resolved and expiry pre-computed on the server (so the client needn't reason
// about dates or clocks). `activeUntil` is a plain YYYY-MM-DD string or null.
export type SponsorListItem = {
  id: string;
  name: string;
  href: string | null;
  logoId: string | null;
  logo: ResolvedImage | null;
  activeUntil: string | null;
  expired: boolean;
};

// Every sponsorId referenced by sponsor blocks in an issue (deduped). Accepts
// any pages-holding shape so callers can resolve a subset if needed.
export function collectSponsorIds(
  content: Pick<IssueContent, "pages">,
): string[] {
  const ids = new Set<string>();
  for (const page of content.pages) {
    for (const block of page.blocks) {
      if (block.type === "sponsor" && block.sponsorId) ids.add(block.sponsorId);
    }
  }
  return [...ids];
}

// Local-date floor comparison: a sponsor is expired once its `activeUntil`
// calendar day is strictly before today. Kept date-level (not instant-level) so
// "active until the 3rd" stays active all through the 3rd. Expiry is advisory —
// it flags the admin list; it never removes a sponsor from a published issue.
export function isSponsorExpired(
  activeUntil: Date | null,
  now: Date = new Date(),
): boolean {
  if (!activeUntil) return false;
  const floor = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return floor(activeUntil) < floor(now);
}

// A timestamptz -> the YYYY-MM-DD the admin entered (in local time), for the
// date input's value and the list display. Null passes through.
export function activeUntilToDateString(activeUntil: Date | null): string | null {
  if (!activeUntil) return null;
  const y = activeUntil.getFullYear();
  const m = String(activeUntil.getMonth() + 1).padStart(2, "0");
  const d = String(activeUntil.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
