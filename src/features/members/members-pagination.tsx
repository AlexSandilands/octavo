"use client";

import { useEffect, useRef } from "react";
import { adminMain } from "@/components/admin-main";
import { Button } from "@/components/ui";
import { useListUrl } from "./use-list-url";

// The foot of the members table: previous/next plus where you are. Two big
// labelled buttons rather than a row of page numbers — the audience is older
// and phone-heavy, and the house md Button gives the 48px targets and focus
// treatment for free. The buttons navigate (?page= in the URL) so the position
// survives a refresh; page 1 keeps a bare URL. Absent on a single page.
export function MembersPagination({
  page,
  pageCount,
}: {
  page: number;
  pageCount: number;
}) {
  const go = useListUrl();

  // Turning a page starts reading again from the top, like any navigation.
  // Next's own scroll-to-top can't do it here: in the admin shell the window
  // never scrolls — the shared admin-main pane does. Keyed on the *served*
  // page and run after render, so the jump lands on the new rows rather than
  // racing ahead of them; back/forward and post-mutation clamps get the same
  // treatment, which is what a page change means regardless of its trigger.
  const lastPage = useRef(page);
  useEffect(() => {
    if (page !== lastPage.current) {
      lastPage.current = page;
      (adminMain() ?? window).scrollTo({ top: 0 });
    }
  }, [page]);

  if (pageCount <= 1) return null;

  // Keep the rest of the list state (?q=, ?filter=); page 1 stays implicit.
  const turnTo = (p: number) => go({ page: p > 1 ? String(p) : null });

  return (
    <nav
      aria-label="Member list pages"
      className="mt-6 flex items-center justify-between gap-3"
    >
      <Button
        variant="secondary"
        icon="chevronLeft"
        iconPosition="left"
        disabled={page <= 1}
        onClick={() => turnTo(page - 1)}
      >
        Previous
      </Button>
      <span aria-live="polite" className="text-faint font-sans text-sm">
        Page {page} of {pageCount}
      </span>
      <Button
        variant="secondary"
        icon="chevronRight"
        disabled={page >= pageCount}
        onClick={() => turnTo(page + 1)}
      >
        Next
      </Button>
    </nav>
  );
}
