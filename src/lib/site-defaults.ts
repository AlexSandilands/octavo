import {
  DEFAULT_FOOTER_STYLE,
  DEFAULT_PDF_DOWNLOADS,
  type SiteSettings,
} from "./branding";

// Deployment defaults for the magazine's branding text, set per-deployment via
// NEXT_PUBLIC_* env vars (see .env.example) so a fresh install has sensible
// wording before anyone opens the admin. Defaults are intentionally generic
// placeholders — not a real club.
//
// These are *bootstrap defaults only*. The source of truth is the `settings`
// row the owner edits at /admin/magazine (issue #105); this module is the
// fallback layer underneath it and is read by exactly one consumer,
// src/server/settings.ts. Nothing else may read these env vars — resolve the
// effective values through getSettings() instead, or the two halves drift.
//
// Safe to read at module top level: NEXT_PUBLIC_* vars are build-time inlined,
// not runtime secrets, so this does not reintroduce the issue #67 build
// requirement.
export const siteDefaults: SiteSettings = {
  // Magazine name — shown as the masthead/wordmark throughout.
  name: process.env.NEXT_PUBLIC_MAGAZINE_NAME ?? "The Magazine",
  // Owning club / organisation name.
  org: process.env.NEXT_PUBLIC_ORG_NAME ?? "Your Club",
  // One-line description, used on sign-in and in metadata.
  tagline:
    process.env.NEXT_PUBLIC_TAGLINE ?? "A members-only digital magazine.",
  // The footer appearance has no env var — its default is the look the code
  // shipped with, so an untouched deployment is unchanged by issue #105.
  footer: DEFAULT_FOOTER_STYLE,
  // Likewise the PDF download switch (issue #162): no env var, its default is
  // the behaviour the code shipped with — downloads on.
  pdfDownloads: DEFAULT_PDF_DOWNLOADS,
};
