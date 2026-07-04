import type { ReactNode } from "react";
import type { SponsorCardProps } from "./shared";

// The layout-theme contract (issue #40). A layout theme is the *editorial* look
// an admin picks per issue — the typography/decoration treatment of blocks and
// the page chrome — distinct from the deployment brand skin (the palette, see
// src/lib/brands.ts). Each theme is one module (classic.tsx, modern.tsx, …) that
// fills in this contract; BlockView and PageFrame render generically from it, so
// adding a theme is "add a module + a registry entry", never editing a
// `theme === "…"` conditional. The contract is expressive enough for the
// existing classic/modern designs (class strings for the simple slots, small
// render functions for the structurally divergent ones).

export interface HeadingStyles {
  /** Eyebrow above main/section titles (paragraph sub-heads omit it). */
  kicker: string;
  /** A small run-in sub-head (level "paragraph"): the title element's classes. */
  paragraph: string;
  /** A section sub-head (level "section"): its wrapper + title classes. */
  section: { wrapper: string; title: string };
  /** A main/feature title (level "main"): wrapper + title, plus an optional
   *  decorative rule rendered after the title (classic's centred diamond). */
  main: { wrapper: string; title: string; rule?: () => ReactNode };
}

export interface ImageStyles {
  /** The missing-image placeholder: its box + the inner "PHOTO" label classes. */
  placeholder: { box: string; label: string };
  /** Wrap the caption content in the theme's <figcaption> treatment. */
  caption: (content: ReactNode) => ReactNode;
}

export interface PageDecorationContext {
  issueNo: number;
  side: "left" | "right";
}

export interface LayoutTheme {
  /** Stable id — the value stored in `issues.theme`, in the PDF cache key, and
   *  in NEXT_PUBLIC_ISSUE_THEMES. Lowercase, url/enum-safe. */
  id: string;
  /** Human label shown in the editor picker and the reader's theme toggle. */
  name: string;
  heading: HeadingStyles;
  image: ImageStyles;
  /** The sponsor card, laid out from the theme-independent resolved props. */
  sponsor: (props: SponsorCardProps) => ReactNode;
  /** The page chrome PageFrame paints behind the content (borders/masthead or
   *  accent bar). The running footer stays shared in PageFrame. */
  page: { decoration: (ctx: PageDecorationContext) => ReactNode };
}
