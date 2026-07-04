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
