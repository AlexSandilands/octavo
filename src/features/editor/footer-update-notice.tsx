"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { adoptFooterAction } from "@/app/admin/actions";

// The offer to bring one issue's running footer up to the magazine's current
// setting (issue #128).
//
// The footer settings at /admin/magazine are global, but a page's text limit is
// fixed when the page is authored — the footer grows upward from the bottom
// margin, and content never reflows at read time. So a footer the owner has
// made taller is held back on issues whose pages were laid out for a shorter
// one, and this is where that is said out loud and undone.
//
// It sits above the canvas rather than in the header because it has something to
// explain, and because the consequence lands right below it: adopting a taller
// footer takes a little room off every page, and the editor's overflow marker is
// what catches a page that no longer fits.
export function FooterUpdateNotice({
  issueId,
  flushSave,
}: {
  issueId: string;
  /** The editor's save flush. The canvas is about to be re-rendered from the
   *  server with the taller footer, and an edit that hadn't autosaved yet would
   *  be lost in that refresh — so nothing is adopted until it lands. */
  flushSave: () => Promise<boolean>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <div className="border-line bg-warn-soft flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b px-6 py-3">
      <p className="text-body max-w-[70ch] font-sans text-[13px] leading-relaxed">
        <strong className="font-semibold">
          This issue still has the older, smaller page footer.
        </strong>{" "}
        The footer set on the Magazine screen is taller than this issue&rsquo;s
        pages were made for, so it is being held back here rather than printed
        over the last lines. Bringing it up to date leaves slightly less room on
        every page — any page whose contents no longer fit will be marked, with
        an action to move the overflow along.
      </p>
      <Button
        variant="secondary"
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            if (!(await flushSave())) return;
            if ((await adoptFooterAction(issueId)).ok) router.refresh();
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Updating…" : "Use the new footer"}
      </Button>
    </div>
  );
}
