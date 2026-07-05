import type { Metadata } from "next";
import { Newsreader, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { site } from "@/lib/site";
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

export const metadata: Metadata = {
  title: `${site.name} — ${site.org}`,
  description: site.tagline,
  // Members-only site — everything stays out of search indexes (decision
  // settled with the reader gate; see src/app/robots.ts).
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // data-brand selects the deployment brand skin's palette (issue #40): the
    // default "heritage" is the @theme baseline, other brands are override blocks
    // in brands.css keyed off this attribute. Validated in lib/env.ts.
    <html
      lang="en"
      data-brand={env.NEXT_PUBLIC_BRAND}
      className={`${serif.variable} ${sans.variable} ${mono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
