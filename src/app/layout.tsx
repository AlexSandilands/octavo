import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { BrandingProvider } from "@/components/branding";
import { getSettings } from "@/server/settings";
import { env } from "@/lib/env";

// The three families are self-hosted from ./fonts rather than fetched from
// Google (issue #167): next/font/google downloads them at *build* time, so every
// CI run and every production deploy needed fonts.gstatic.com reachable, and one
// flaked fetch failed an otherwise-green build. The committed woff2 files are the
// same faces at the same versions Google was serving — see ./fonts/README.md for
// each file's source URL and the command that rebuilds it.
//
// preload:false on purpose (issue #72). These faces are applied indirectly —
// as CSS variables consumed through Tailwind utilities (font-serif / font-sans /
// font-mono), never via a next/font className on the rendered element — so
// next/font can't tell which faces the first paint actually needs and emits a
// <link rel="preload"> for every declared weight/style. The LCP on every
// members-facing route is a cover/page image (which keeps its own correct,
// always-used preload), not text, so those speculative font preloads sit unused
// and Chrome logs "preloaded … but not used". With preload off the faces still
// load from the stylesheet and swap in (display:swap default, size-adjusted
// fallback → negligible CLS); we just stop asking the browser to preload them.
//
// Newsreader and Hanken Grotesk are variable fonts, so one file covers the whole
// weight range each was declared at; IBM Plex Mono has no variable cut and keeps
// a file per weight. adjustFontFallback names the family next/font measures its
// size-adjusted fallback against — the serif wants Times New Roman, matching what
// next/font/google picked for it from the family's category.
//
// Name these bindings after the typeface, not the role it plays: next/font/local
// takes the CSS `font-family` straight from the variable name, so `serif`/`sans`/
// `mono` would emit @font-face families that collide with the CSS generic
// keywords of the same name.
const newsreader = localFont({
  src: [
    {
      path: "./fonts/newsreader-roman.woff2",
      weight: "400 600",
      style: "normal",
    },
    {
      path: "./fonts/newsreader-italic.woff2",
      weight: "400 600",
      style: "italic",
    },
  ],
  variable: "--font-newsreader",
  adjustFontFallback: "Times New Roman",
  preload: false,
});

const hanken = localFont({
  src: [
    {
      path: "./fonts/hanken-grotesk.woff2",
      weight: "400 700",
      style: "normal",
    },
  ],
  variable: "--font-hanken",
  preload: false,
});

const plexMono = localFont({
  src: [
    { path: "./fonts/ibm-plex-mono-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-mono-500.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-plex",
  preload: false,
});

// Async because the title and description are owner-editable now (issue #105)
// and come from the settings row, not from build-time env. Every route already
// renders dynamically for the CSP nonce, so this costs one cached query per
// request rather than a rendering-mode change.
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    title: `${settings.name} — ${settings.org}`,
    description: settings.tagline,
    // Members-only site — everything stays out of search indexes (decision
    // settled with the reader gate; see src/app/robots.ts).
    robots: { index: false, follow: false },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { name, org, tagline } = await getSettings();
  return (
    // data-brand selects the deployment brand skin's palette (issue #40): the
    // default "heritage" is the @theme baseline, other brands are override blocks
    // in brands.css keyed off this attribute. Validated in lib/env.ts.
    <html
      lang="en"
      data-brand={env.NEXT_PUBLIC_BRAND}
      className={`${newsreader.variable} ${hanken.variable} ${plexMono.variable}`}
    >
      <body>
        {/* The branding text for the two client surfaces that have no server
            boundary to take it as a prop (see components/branding.tsx). */}
        <BrandingProvider value={{ name, org, tagline }}>
          {children}
        </BrandingProvider>
      </body>
    </html>
  );
}
