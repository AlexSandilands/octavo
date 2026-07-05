// Deployment brand skins — the app-wide palette, swappable per deployment so the
// same codebase can serve a different club/org without touching code (the visual
// counterpart of the NEXT_PUBLIC_* branding text in site.ts). A brand is a set of
// Tailwind v4 `--color-*` token overrides; `heritage` is the built-in default
// (the warm-paper/green look, defined by the @theme block in globals.css) and
// each other brand is a `[data-brand="…"]` override block in brands.css. The root
// layout stamps `<html data-brand={env.NEXT_PUBLIC_BRAND}>`, so every existing
// `bg-paper`/`text-ink` utility resolves to the active brand's tokens with no
// component changes. See docs/design-principles.md §6 for how to author one.
//
// This module holds only the id list (no server-only imports) so both env.ts
// (validation) and the root layout can use it. NEXT_PUBLIC_BRAND is build-time
// inlined — switching brands is a rebuild, matching how the text branding vars
// and Railway deploys already work.

export const BRAND_IDS = ["heritage", "coastal"] as const;
export type BrandId = (typeof BRAND_IDS)[number];
export const DEFAULT_BRAND: BrandId = "heritage";

// Colours for the generated app icon (src/app/icon.tsx + apple-icon.tsx). The
// icon is an ImageResponse PNG, which can't read the CSS `--color-*` tokens, so
// the two the mark needs are mirrored here from each brand's palette (globals.css
// @theme for heritage, brands.css for the rest): `bg` is the brand accent,
// `fg` the paper the monogram sits on. Only these two per brand, changed only if
// the accent/paper identity shifts — keep in step with the tokens above.
export const BRAND_ICON_COLORS: Record<BrandId, { bg: string; fg: string }> = {
  heritage: { bg: "#1d4d3e", fg: "#f4f0e8" },
  coastal: { bg: "#1f4e63", fg: "#ecedf1" },
};

// The active deployment brand, read from the build-time-inlined
// NEXT_PUBLIC_BRAND. env.ts already validates this strictly at boot (an unknown
// value fails there), so this is a lightweight, server-only-free accessor for
// the few non-server-component call sites — e.g. the generated app icon
// (src/app/icon.tsx) — that must not drag env.ts's DATABASE_URL/AUTH_SECRET
// validation into their build-time bundle. Falls back to the default defensively.
export function activeBrand(): BrandId {
  const value = process.env.NEXT_PUBLIC_BRAND;
  return value && (BRAND_IDS as readonly string[]).includes(value)
    ? (value as BrandId)
    : DEFAULT_BRAND;
}
