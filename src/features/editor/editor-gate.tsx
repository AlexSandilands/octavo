"use client";

import { useEffect, useState, type ReactNode } from "react";
import { EmptyCard } from "@/components/empty-states";
import { Button } from "@/components/ui";

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
  if (isDesktop === null) return <div className="bg-ground min-h-dvh" />;
  if (isDesktop) return <>{children}</>;
  return <MobileNotice />;
}

function MobileNotice() {
  return (
    <div className="bg-ground flex min-h-dvh flex-col justify-center p-4">
      <EmptyCard
        icon="fitScreen"
        title="Editing needs a larger screen"
        body="The issue editor is a page-layout tool built for a desktop or laptop. Open this issue on a computer to edit it. You can still read and manage everything else from your phone."
      >
        <Button href="/admin" variant="secondary" icon="arrowLeft">
          Back to issues
        </Button>
      </EmptyCard>
    </div>
  );
}
