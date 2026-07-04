import { classicTheme } from "./classic";
import { modernTheme } from "./modern";
import type { LayoutTheme } from "./types";

export type { LayoutTheme } from "./types";

// The layout-theme registry (issue #40): the single source of truth for which
// editorial layout themes exist. Everything downstream — the id union, the zod
// enum in admin/actions.ts, the editor picker, the reader toggle, the PDF theme —
// is derived from this list, so adding a theme is: write a module, add it here.
//
// To add a theme: create src/features/blocks/themes/<id>.tsx (a `satisfies
// LayoutTheme` object), then add it to LAYOUT_THEMES below. No edits to
// block-view.tsx conditionals, the admin zod schema, or the pickers are needed.
export const LAYOUT_THEMES = [classicTheme, modernTheme] as const;

// The stored/URL/enum id union, derived from the modules ("classic" | "modern").
export type LayoutThemeId = (typeof LAYOUT_THEMES)[number]["id"];

// Kept for callers/schemas that want the id list as a value.
export const THEME_IDS = LAYOUT_THEMES.map((t) => t.id) as LayoutThemeId[];

// The built-in default — the theme a fresh issue and the reader open with, and
// what an unknown stored value degrades to. Must be one of LAYOUT_THEMES.
export const DEFAULT_THEME_ID: LayoutThemeId = "classic";

const byId = new Map<string, LayoutTheme>(LAYOUT_THEMES.map((t) => [t.id, t]));

export function isThemeId(value: string): value is LayoutThemeId {
  return byId.has(value);
}

export function getTheme(id: LayoutThemeId): LayoutTheme {
  return byId.get(id)!;
}

// Resolve a stored/free-text theme to a renderable theme, degrading an unknown
// (or deployment-disabled) value to the default. Reading is never gated by
// config: this always returns a theme, never throws (issues.theme is free text,
// and a brand may have disabled a theme an old issue still uses).
export function resolveTheme(id: string | undefined | null): LayoutTheme {
  return (id ? byId.get(id) : undefined) ?? byId.get(DEFAULT_THEME_ID)!;
}

// Which themes this deployment offers, gated by NEXT_PUBLIC_ISSUE_THEMES (a
// build-time-inlined comma list, e.g. "classic,modern"; unset = all). Unknown
// names in the list are ignored; an empty/all-invalid result falls back to every
// theme so a misconfiguration never leaves the editor with no theme to pick.
// Read from process.env directly (not lib/env, which is server-only) so this
// works in the client pickers too; env.ts validates the value at server boot.
export function enabledThemeIds(): LayoutThemeId[] {
  const raw = process.env.NEXT_PUBLIC_ISSUE_THEMES;
  if (!raw) return THEME_IDS;
  const wanted = new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  const enabled = THEME_IDS.filter((id) => wanted.has(id));
  return enabled.length > 0 ? enabled : THEME_IDS;
}

export function enabledThemes(): LayoutTheme[] {
  return enabledThemeIds().map(getTheme);
}

// The default theme to use where one must be chosen (a new issue, the reader's
// initial view), respecting the enabled set: the built-in default when it's
// enabled, else the first enabled theme.
export function defaultEnabledThemeId(): LayoutThemeId {
  const enabled = enabledThemeIds();
  return enabled.includes(DEFAULT_THEME_ID) ? DEFAULT_THEME_ID : enabled[0]!;
}

// Normalise a stored/free-text theme to an *enabled* id, for editor state: keep
// the stored value when it's a known, enabled theme; otherwise fall back to the
// enabled default. (Rendering uses resolveTheme, which keeps disabled-but-known
// themes so existing issues still render as authored.)
export function normaliseEnabledThemeId(
  value: string | undefined | null,
): LayoutThemeId {
  const enabled = enabledThemeIds();
  return value && isThemeId(value) && enabled.includes(value)
    ? value
    : defaultEnabledThemeId();
}
