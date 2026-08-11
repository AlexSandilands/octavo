// The magazine's own identity: the branding wording and the running footer's
// appearance. The owner edits both at /admin/magazine; the effective values for
// a request are resolved server-side (src/server/settings.ts) from the stored
// row, falling back to the deployment defaults (src/lib/site-defaults.ts).
//
// This module is deliberately framework- and server-free: every value here is
// public branding, so the resolved object is threaded into client components as
// props (readers, editor, admin preview) without dragging `db`/`env` along.

// Both scales are ordered by the footer HEIGHT they produce, smallest first
// (mark: 18/27/36px, type: a 14/16/19px line box — measured, see page-footer).
// The per-issue clamp below reads that order, so a new value must be inserted at
// its height position rather than appended.
export const MARK_SIZES = ["small", "medium", "large"] as const;
export type MarkSize = (typeof MARK_SIZES)[number];

export const TEXT_SIZES = ["small", "medium", "large"] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

// Absolute, not mirrored: both pages of a spread (and the mobile closer) align
// the same way, so a spread reads as one setting rather than two. A fourth
// value ("mirrored") can join the union later without a migration — the column
// is plain text validated here, not a Postgres enum.
export const FOOTER_ALIGNS = ["left", "center", "right"] as const;
export type FooterAlign = (typeof FOOTER_ALIGNS)[number];

/** How the running footer is set. Applies to the logo lockup (mark size,
 *  alignment) and, for the type size, to the no-logo footer as well — the two
 *  forms share one type treatment on purpose (see page-footer.tsx). */
export type FooterStyle = {
  markSize: MarkSize;
  textSize: TextSize;
  align: FooterAlign;
};

/** The branding wording: masthead/wordmark, the owning club, the standfirst. */
export type Branding = {
  name: string;
  org: string;
  tagline: string;
};

/** Everything the owner controls at /admin/magazine, resolved for a request.
 *
 *  `pdfDownloads` is its own member rather than part of Branding or FooterStyle:
 *  it is not wording and it is not an appearance, it is whether the download is
 *  offered at all (issue #162). Nothing that draws a page reads it. */
export type SiteSettings = Branding & {
  footer: FooterStyle;
  pdfDownloads: boolean;
};

// The deployment defaults for the appearance group. These reproduce the
// footer exactly as it shipped in issue #104, so a deployment that never opens
// the page renders byte-identically to before this setting existed.
export const DEFAULT_FOOTER_STYLE: FooterStyle = {
  markSize: "medium",
  textSize: "medium",
  align: "left",
};

// Same story for the download switch: a code constant, no env counterpart (the
// footer appearance set that precedent — see src/lib/site-defaults.ts). It is
// `true` because the download is what the site shipped with, so an untouched
// deployment is unchanged by issue #162.
//
// Note the asymmetry this creates with the other settings. Their bad-value
// fallback is "render the default", and a wrong footer size is cosmetic; here
// the default is *enabled*, so a database read failure (which degrades every
// field to its default — see readStored in src/server/settings.ts) serves
// downloads to a club that turned them off. That is a deliberate fail-open: the
// alternative is that a database blip silently withdraws a working feature from
// every member, and the setting is a distribution preference, not an auth gate —
// the members-only check on the route is separate and fails closed.
export const DEFAULT_PDF_DOWNLOADS = true;

/** The `settings` row as stored: every field nullable, NULL meaning "use the
 *  deployment default". This is the admin form's state as well as the database
 *  shape — the page edits nulls directly so "cleared" stays distinguishable
 *  from "set to the same text the default happens to have". */
export type StoredSettings = {
  magazineName: string | null;
  orgName: string | null;
  tagline: string | null;
  footerMarkSize: MarkSize | null;
  footerTextSize: TextSize | null;
  footerAlign: FooterAlign | null;
  pdfDownloads: boolean | null;
};

export const EMPTY_SETTINGS: StoredSettings = {
  magazineName: null,
  orgName: null,
  tagline: null,
  footerMarkSize: null,
  footerTextSize: null,
  footerAlign: null,
  pdfDownloads: null,
};

/** Stored row + deployment defaults → the values that actually render. Pure and
 *  dependency-free so the admin's live preview can run the same resolution on
 *  unsaved edits that the server runs on the saved row. */
export function resolveSettings(
  stored: StoredSettings,
  defaults: SiteSettings,
): SiteSettings {
  return {
    name: stored.magazineName ?? defaults.name,
    org: stored.orgName ?? defaults.org,
    tagline: stored.tagline ?? defaults.tagline,
    footer: {
      markSize: stored.footerMarkSize ?? defaults.footer.markSize,
      textSize: stored.footerTextSize ?? defaults.footer.textSize,
      align: stored.footerAlign ?? defaults.footer.align,
    },
    // `??`, not `||`: a stored `false` is the owner's answer, and `||` would
    // read it as "nothing stored" and hand back the enabled default — the one
    // value they went to the admin to change.
    pdfDownloads: stored.pdfDownloads ?? defaults.pdfDownloads,
  };
}

// ── The per-issue footer reserve (issue #128) ───────────────────────────────
//
// The footer settings are global, but a page's text limit is fixed at the
// moment it is authored: the editor measures overflow against the footer's top
// edge, and content never reflows at read time. The footer is bottom-anchored
// and grows *upward*, so enlarging the mark or the type after the fact pushes
// its top edge into the last lines of pages that were already filled — on
// published issues, in the flipbook and in regenerated PDFs.
//
// There is no room to grow the other way: the page's bottom margin is 22px
// (classic) / 16px (modern) and the mark's range is 18px, so pinning the top
// edge and letting the mark grow down would hang it off the page edge. And a
// settings-invariant limit can only ever be the *tallest* footer's, which is
// lower than the limit small/medium-authored pages already used — so no
// edit-time reservation can retroactively protect them either.
//
// What remains is to stop the footer growing past what the page left for it.
// Each issue records the two sizes its pages were laid out against — its
// *reserve* — and the rendered footer is clamped to it. A smaller footer always
// applies (it can only free space); a larger one applies to the issues that have
// the room, and waits on the rest until the author adopts it in the editor,
// where the overflow marker is there to catch what no longer fits.

/** The footer sizes an issue's pages were laid out against. Only the two that
 *  change the footer's height — alignment moves the lockup, not the top edge.
 *
 *  Named for the `issues` columns that hold it, so an issue row satisfies this
 *  as it comes out of the database and every render surface can pass the row
 *  straight in without a translation step to get wrong. */
export type FooterReserve = {
  footerMarkSize: MarkSize;
  footerTextSize: TextSize;
};

/** The smaller of two values on a height-ordered scale. */
function shorter<T extends string>(scale: readonly T[], a: T, b: T): T {
  return scale.indexOf(a) <= scale.indexOf(b) ? a : b;
}

/** The reserve new content is laid out against: whatever is set right now. */
export function footerReserveOf(footer: FooterStyle): FooterReserve {
  return { footerMarkSize: footer.markSize, footerTextSize: footer.textSize };
}

/** The footer that may actually render on an issue's pages: the live setting,
 *  held to the issue's reserve on both height axes. Alignment passes through —
 *  it has no effect on the footer's height, so it is safe retroactively. */
export function clampFooterStyle(
  live: FooterStyle,
  reserve: FooterReserve,
): FooterStyle {
  return {
    markSize: shorter(MARK_SIZES, live.markSize, reserve.footerMarkSize),
    textSize: shorter(TEXT_SIZES, live.textSize, reserve.footerTextSize),
    align: live.align,
  };
}

/** True when the live setting is taller than the issue's pages have room for —
 *  i.e. the issue is holding the footer back. Drives the editor's affordance. */
export function footerHeldBack(
  live: FooterStyle,
  reserve: FooterReserve,
): boolean {
  const held = clampFooterStyle(live, reserve);
  return held.markSize !== live.markSize || held.textSize !== live.textSize;
}

/** The settings one issue's pages render with. Every surface that draws a page
 *  (reader, mobile closer, editor canvas, thumbnail, print document) resolves
 *  this once and threads it down, so all of them agree — and so does the PDF
 *  cache key, which fingerprints the same object. */
export function settingsForIssue(
  settings: SiteSettings,
  reserve: FooterReserve,
): SiteSettings {
  return {
    ...settings,
    footer: clampFooterStyle(settings.footer, reserve),
  };
}

// Human labels for the admin dropdowns. Kept beside the unions so adding a
// value can't leave the picker showing a raw id.
export const MARK_SIZE_LABELS: Record<MarkSize, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
};

export const TEXT_SIZE_LABELS: Record<TextSize, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
};

export const FOOTER_ALIGN_LABELS: Record<FooterAlign, string> = {
  left: "Left",
  center: "Centre",
  right: "Right",
};
