"use client";

import { MenuSelect } from "@/components/menu-select";
import type { MemberFilter } from "@/server/users";
import { useListUrl } from "@/components/use-list-url";

const OPTIONS: { value: MemberFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "admins", label: "Admins" },
  { value: "subscribed", label: "Subscribed" },
  { value: "unsubscribed", label: "Unsubscribed" },
];

// The status filter beside the search — the house MenuSelect ("Filter: All"),
// which always names the active choice on its trigger, matches the search
// box's 44px height, and has room to grow when the list learns new filters
// (a fifth option would have burst the old segmented control's row). Like the
// search, the choice lives in the URL (?filter=) and the narrowing runs in
// the database — the list only serves one page, so a client-side filter would
// go blind past it. "All" is the absence of the param, keeping bare URLs bare.
export function MembersFilter({ filter }: { filter: MemberFilter }) {
  const go = useListUrl();
  const current = OPTIONS.find((o) => o.value === filter) ?? OPTIONS[0]!;

  // A new filter starts from its own first page; the search carries over.
  // push, not replace: a filter choice is one deliberate gesture (unlike the
  // search's debounced keystrokes), and Back should return to the previous
  // view the way it does after a page turn.
  return (
    <MenuSelect
      label="Filter"
      current={current.label}
      ariaLabel="Filter members"
      size="md"
      // Full-width on a phone (and the menu stays on-screen under it); its
      // natural pill width once the toolbar goes to a row.
      className="w-full justify-between lg:w-auto lg:justify-start"
      items={OPTIONS.map((o) => ({
        key: o.value,
        value: o.value,
        content: o.label,
      }))}
      value={filter}
      onSelect={(next) =>
        go({ filter: next === "all" ? null : next, page: null })
      }
    />
  );
}
