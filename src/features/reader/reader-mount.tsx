"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { IssueContent } from "@/lib/blocks";
import type { ImageMap } from "@/lib/images";
import type { SponsorMap } from "@/lib/sponsors";

// The desktop flipbook and the mobile scroll reader are large, mutually
// exclusive client bundles. Loading them as `next/dynamic` boundaries and
// mounting only the one the viewport needs keeps the other's JS (and its deps)
// off the wire — a phone never downloads the flipbook, a desktop never the
// mobile reader. `ssr: false` because the choice is viewport-driven and can't be
// made on the server; the tradeoff is a brief paper-coloured fallback before the
// active reader's chunk resolves (documented in the issue). No inline scripts —
// dynamic() uses ordinary chunk loading, so the nonce-based CSP is untouched.
const DesktopReader = dynamic(
  () => import("./desktop-reader").then((m) => m.DesktopReader),
  { ssr: false, loading: () => <ReaderFallback /> },
);
const MobileReader = dynamic(
  () => import("./mobile-reader").then((m) => m.MobileReader),
  { ssr: false, loading: () => <ReaderFallback /> },
);

// Tailwind's `md` breakpoint — the same threshold the old CSS toggle used.
const DESKTOP_QUERY = "(min-width: 768px)";

export function ReaderMount({
  content,
  issueNo,
  images,
  sponsors,
}: {
  content: IssueContent;
  issueNo: number;
  images: ImageMap;
  sponsors: SponsorMap;
}) {
  // `null` until mounted: matchMedia isn't available during SSR, and picking the
  // wrong reader then swapping would download both bundles. The query stays live
  // so rotating a tablet across the breakpoint swaps readers.
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  if (isDesktop === null) return <ReaderFallback />;
  return isDesktop ? (
    <DesktopReader
      content={content}
      issueNo={issueNo}
      images={images}
      sponsors={sponsors}
    />
  ) : (
    <MobileReader content={content} images={images} sponsors={sponsors} />
  );
}

// Full-height paper wash shown while the active reader's chunk loads. aria-busy
// so assistive tech announces the pending state rather than an empty page.
function ReaderFallback() {
  return (
    <div
      className="bg-page min-h-screen"
      role="status"
      aria-busy="true"
      aria-label="Loading issue"
    />
  );
}
