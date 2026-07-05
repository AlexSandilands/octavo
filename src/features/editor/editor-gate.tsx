"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";

// Tailwind's `md` breakpoint — the same threshold the admin rail/drawer use.
const DESKTOP_QUERY = "(min-width: 768px)";

// The page-based editor is a fixed-canvas authoring surface: pan/zoom, a pages
// rail and dense toolbars that assume a wide viewport. It's unusable on a phone,
// so we gate it — desktops get the editor, phones get a clear "use a larger
// screen" message instead of a broken UI. Reading stays fully mobile-supported;
// this is authoring only. Mirrors ReaderMount: `null` until mounted (matchMedia
// isn't available during SSR), and mounting only the branch the viewport needs
// keeps the heavy editor tree off the wire on mobile. The query stays live so
// rotating a tablet across the breakpoint swaps in the editor.
export function EditorGate({ children }: { children: ReactNode }) {
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Paper-coloured hold while we work out the viewport, so neither branch flashes.
  if (isDesktop === null) return <div className="bg-card min-h-screen" />;
  if (isDesktop) return <>{children}</>;
  return <MobileNotice />;
}

function MobileNotice() {
  return (
    <div className="bg-card flex min-h-screen flex-col items-center justify-center px-7 py-12 text-center">
      <div className="bg-tint text-accent flex h-16 w-16 items-center justify-center rounded-full">
        <Icon name="fitScreen" size={30} strokeWidth={1.5} />
      </div>
      <h1 className="text-ink mt-6 font-serif text-2xl">
        Editing needs a larger screen
      </h1>
      <p className="text-muted mt-3 max-w-sm font-sans text-[15px] leading-relaxed">
        The issue editor is a page-layout tool built for a desktop or laptop.
        Open this issue on a computer to edit it. You can still read and manage
        everything else from your phone.
      </p>
      <div className="mt-8">
        <Link
          href="/admin"
          className="border-hair-warm text-ink hover:border-accent hover:bg-accent-wash flex h-12 items-center gap-2 rounded-lg border-[1.5px] bg-white px-5 font-sans text-[15px] font-semibold transition-colors"
        >
          <Icon name="chevronLeft" size={17} strokeWidth={1.8} />
          Back to issues
        </Link>
      </div>
    </div>
  );
}
