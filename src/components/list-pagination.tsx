"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { adminMain } from "@/components/admin-main";
import { Button } from "@/components/ui";
import { useListUrl } from "./use-list-url";

// The foot of a paginated list: previous/next plus where you are. Two big
// labelled buttons rather than a row of page numbers — the audience is older
// and phone-heavy, and the house md Button gives the 48px targets and focus
// treatment for free. The buttons navigate (?page= in the URL) so the position
// survives a refresh; page 1 keeps a bare URL. Absent on a single page.
// Shared by the members, issues and sponsors lists and the members' archive —
// the scroll-to-top below falls back to the window off the admin shell.
export function ListPagination({
  page,
  pageCount,
  label,
}: {
  page: number;
  pageCount: number;
  /** Names the nav for screen readers, e.g. "Member list pages". */
  label: string;
}) {
  const go = useListUrl();

  // The page a click counts from: the served one at rest, the one being
  // fetched while a turn is in flight. Counting from the served page instead
  // meant both halves of a double-click computed the same target, so the
  // second one pushed the URL it was already going to and vanished (#137) —
  // exactly on the slow connections that make double-clicking tempting.
  const [target, setTarget] = useState(page);
  const [pending, startTransition] = useTransition();

  // At rest the target is just the served page — it only leads while a turn is
  // in flight. Reconciling on settle rather than on every render is what keeps
  // it from sliding backwards onto a page the reader is already leaving, and it
  // costs nothing to cover the moves that don't come from these buttons at all:
  // back/forward, and the server clamping a ?page= that fell off the end when
  // rows were removed under the admin's feet.
  useEffect(() => {
    if (!pending) setTarget(page);
  }, [pending, page]);

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

  // Keep whatever else the list keeps in the URL (?q=, ?filter=); page 1 stays
  // implicit.
  // Wrapped in a transition for the same reason the bulk bar's actions are:
  // it gives us a pending flag for the whole round trip, so a slow turn says
  // so instead of looking like a dead button.
  const turnTo = (p: number) => {
    const next = Math.min(Math.max(p, 1), pageCount);
    if (next === target) return;
    setTarget(next);
    startTransition(() => go({ page: next > 1 ? String(next) : null }));
  };

  // `unavailable` rather than `disabled` at the ends. A real disabled attribute
  // arriving on the button you are standing on can't hold focus, so the browser
  // hands it to <body> — and with the scroll-to-top above, the next Tab restarts
  // from the top of the admin shell and you have lost the list entirely (#131).
  // Unavailable buttons stay put, dimmed and inert, and keep their place in the
  // tab order; a screen reader still finds them and says they're unavailable
  // rather than skipping over them as if the end of the list weren't a fact.
  return (
    <nav
      aria-label={label}
      aria-busy={pending}
      className="mt-6 flex items-center justify-between gap-3"
    >
      <Button
        variant="secondary"
        icon="chevronLeft"
        iconPosition="left"
        unavailable={target <= 1}
        onClick={() => turnTo(target - 1)}
      >
        Previous
      </Button>
      {/* Deliberately not disabled while a turn is in flight: the target above
          already makes a second press count, and disabling the button someone
          just pressed would take their keyboard focus with it. The pending
          wording is the feedback instead, and a screen reader hears the turn
          start and then land. */}
      <span aria-live="polite" className="text-faint font-sans text-sm">
        {pending
          ? `Turning to page ${target}…`
          : `Page ${page} of ${pageCount}`}
      </span>
      <Button
        variant="secondary"
        icon="chevronRight"
        unavailable={target >= pageCount}
        onClick={() => turnTo(target + 1)}
      >
        Next
      </Button>
    </nav>
  );
}
