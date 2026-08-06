"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { MemberFilter } from "@/server/users";

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
// global focus ring, and 44px targets (h-11 matches the search box).
export function MembersFilter({ filter }: { filter: MemberFilter }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const apply = (next: MemberFilter) => {
    const params = new URLSearchParams(search);
    // A new filter starts from its own first page; the search carries over.
    params.delete("page");
    if (next === "all") params.delete("filter");
    else params.set("filter", next);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div
      role="group"
      aria-label="Filter members"
      className="border-line flex h-11 items-stretch rounded-lg border-[1.5px] bg-white p-1"
    >
      {OPTIONS.map((o) => {
        const active = o.value === filter;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => apply(o.value)}
            className={`flex-1 cursor-pointer rounded-md px-2 font-sans text-[13px] whitespace-nowrap transition-[background-color,color] duration-150 sm:flex-none sm:px-3.5 ${
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
