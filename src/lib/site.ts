// Branding / club identity. Set per-deployment via NEXT_PUBLIC_* env vars
// (see .env.example) so the same codebase can serve any club without edits.
// Defaults are intentionally generic placeholders — not a real club.
export const site = {
  // Magazine name — shown as the masthead/wordmark throughout.
  name: process.env.NEXT_PUBLIC_MAGAZINE_NAME ?? "The Magazine",
  // Owning club / organisation name.
  org: process.env.NEXT_PUBLIC_ORG_NAME ?? "Your Club",
  // One-line description, used on sign-in and in metadata.
  tagline:
    process.env.NEXT_PUBLIC_TAGLINE ?? "A members-only digital magazine.",
};
