"use client";

import { MenuSelect } from "@/components/menu-select";
import { useListUrl } from "@/components/use-list-url";

export type ListFilterOption<T extends string> = { value: T; label: string };

// A narrowing choice on an admin list — the house MenuSelect ("Status: All"),
// which always names the active choice on its trigger, matches the search box's
// 44px height, and has room to grow when a list learns new options. Like the
// search, the choice lives in the URL and the narrowing runs in the database —
// the list only serves one page, so a client-side filter would go blind past it.
// The default value is the absence of the param, keeping bare URLs bare.
// Shared by the members, issues and sponsors lists.
export function ListFilter<T extends string>({
  label,
  ariaLabel,
  param,
  value,
  options,
  defaultValue = "all" as T,
}: {
  /** Trigger prefix — the control names itself, e.g. "Status". */
  label: string;
  /** Accessible name for the menu, e.g. "Filter issues by status". */
  ariaLabel: string;
  /** The URL parameter this filter owns, e.g. "filter" or "year". */
  param: string;
  value: T;
  options: ListFilterOption<T>[];
  /** The choice that means "no narrowing" and so writes no param. */
  defaultValue?: T;
}) {
  const go = useListUrl();
  const current = options.find((o) => o.value === value) ?? options[0]!;

  // A new choice starts from its own first page; the search and the other
  // filters carry over. push, not replace: choosing a filter is one deliberate
  // gesture (unlike the search's debounced keystrokes), and Back should return
  // to the previous view the way it does after a page turn.
  return (
    <MenuSelect
      label={label}
      current={current.label}
      ariaLabel={ariaLabel}
      size="md"
      // Full-width in whatever the toolbar gives it on a phone (and the menu
      // stays on-screen under it); its natural pill width once it goes to a row.
      className="w-full justify-between lg:w-auto lg:justify-start"
      items={options.map((o) => ({
        key: o.value,
        value: o.value,
        content: o.label,
      }))}
      value={value}
      onSelect={(next) =>
        go({ [param]: next === defaultValue ? null : next, page: null })
      }
    />
  );
}
