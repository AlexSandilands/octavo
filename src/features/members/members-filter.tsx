"use client";

import type { MemberFilter } from "@/server/users";
import { useListUrl } from "./use-list-url";

const OPTIONS: { value: MemberFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "admins", label: "Admins" },
  { value: "subscribed", label: "Subscribed" },
  { value: "unsubscribed", label: "Unsubscribed" },
];

// The status filter beside the search: a segmented control rather than a
// dropdown so every option is visible at once (the audience is older). Like
// the search, the choice lives in the URL (?filter=) and the narrowing runs in
// the database — the list only serves one page, so a client-side filter would
// go blind past it. "All" is the absence of the param, keeping bare URLs bare.
// A segmented control needs its own shape, so it isn't a house Button, but it
// keeps the same contract: pointer cursor, hover feedback, a transition, the
// global focus ring, and 44px targets — on the buttons themselves (min-h-11),
// not just the frame around them, so the control runs a little taller than
// the search box rather than shaving the hit area.
export function MembersFilter({ filter }: { filter: MemberFilter }) {
  const go = useListUrl();

  // A new filter starts from its own first page; the search carries over.
  // push, not replace: a filter click is one deliberate gesture (unlike the
  // search's debounced keystrokes), and Back should return to the previous
  // view the way it does after a page turn.
  const apply = (next: MemberFilter) =>
    go({ filter: next === "all" ? null : next, page: null });

  return (
    <div
      role="group"
      aria-label="Filter members"
      className="border-line flex items-stretch rounded-lg border-[1.5px] bg-white p-1"
    >
      {OPTIONS.map((o) => {
        const active = o.value === filter;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => apply(o.value)}
            className={`min-h-11 flex-1 cursor-pointer rounded-md px-2 font-sans text-[13px] whitespace-nowrap transition-[background-color,color] duration-150 sm:flex-none sm:px-3.5 ${
              active
                ? "bg-tint text-accent font-semibold"
                : "text-muted hover:bg-accent-wash hover:text-accent font-medium"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
