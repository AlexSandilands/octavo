// The magazine's own identity: the branding wording and the running footer's
// appearance. The owner edits both at /admin/magazine; the effective values for
// a request are resolved server-side (src/server/settings.ts) from the stored
// row, falling back to the deployment defaults (src/lib/site-defaults.ts).
//
// This module is deliberately framework- and server-free: every value here is
// public branding, so the resolved object is threaded into client components as
// props (readers, editor, admin preview) without dragging `db`/`env` along.

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

/** Everything the owner controls at /admin/magazine, resolved for a request. */
export type SiteSettings = Branding & { footer: FooterStyle };

// The deployment defaults for the appearance group. These reproduce the
// footer exactly as it shipped in issue #104, so a deployment that never opens
// the page renders byte-identically to before this setting existed.
export const DEFAULT_FOOTER_STYLE: FooterStyle = {
  markSize: "medium",
  textSize: "medium",
  align: "left",
};

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
};

export const EMPTY_SETTINGS: StoredSettings = {
  magazineName: null,
  orgName: null,
  tagline: null,
  footerMarkSize: null,
  footerTextSize: null,
  footerAlign: null,
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
