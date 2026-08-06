"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui";

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
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  if (pageCount <= 1) return null;

  const go = (p: number) => {
    // Keep the rest of the list state (?q=, ?filter=); page 1 stays implicit.
    const params = new URLSearchParams(search);
    if (p > 1) params.set("page", String(p));
    else params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

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
        onClick={() => go(page - 1)}
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
        onClick={() => go(page + 1)}
      >
        Next
      </Button>
    </nav>
  );
}
