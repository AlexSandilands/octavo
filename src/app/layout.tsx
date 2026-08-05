import type { Metadata } from "next";
import { Newsreader, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { BrandingProvider } from "@/components/branding";
import { getSettings } from "@/server/settings";
import { env } from "@/lib/env";

// preload:false on purpose (issue #72). These faces are applied indirectly —
// as CSS variables consumed through Tailwind utilities (font-serif / font-sans /
// font-mono), never via a next/font className on the rendered element — so
// next/font can't tell which faces the first paint actually needs and emits a
// <link rel="preload"> for every declared subset/weight/style. The LCP on every
// members-facing route is a cover/page image (which keeps its own correct,
// always-used preload), not text, so those speculative font preloads sit unused
// and Chrome logs "preloaded … but not used". With preload off the faces still
// load from the stylesheet and swap in (display:swap default, size-adjusted
// fallback → negligible CLS); we just stop asking the browser to preload them.
const serif = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  style: ["normal", "italic"],
  weight: ["400", "500", "600"],
  preload: false,
});

const sans = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  weight: ["400", "500", "600", "700"],
  preload: false,
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex",
  weight: ["400", "500"],
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
      className={`${serif.variable} ${sans.variable} ${mono.variable}`}
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
