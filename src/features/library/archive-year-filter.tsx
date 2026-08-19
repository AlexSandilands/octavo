"use client";

import { MenuSelect } from "@/components/menu-select";
import { useListUrl } from "@/components/use-list-url";

// The archive's year filter — the house MenuSelect, which names the active
// choice on its trigger and meets the tap-target floor at size "md". The years
// come from the database (only years that have a published issue), the choice
// lives in the URL (?year=) and the narrowing runs in SQL, because the page
// serves one screen of covers and a client-side filter would go blind past it.
// "All years" is the absence of the param, keeping bare URLs bare.
export function ArchiveYearFilter({
  year,
  years,
}: {
  /** The active year, or null for all of them. */
  year: number | null;
  years: number[];
}) {
  const go = useListUrl();
  const options = [
    { value: null, label: "All years" },
    ...years.map((y) => ({ value: y, label: String(y) })),
  ];
  const current = options.find((o) => o.value === year) ?? options[0]!;

  // A new year starts from its own first page; the search carries over. push,
  // not replace: this is one deliberate gesture, and Back should return to the
  // previous view the way it does after a page turn.
  return (
    <MenuSelect
      label="Year"
      current={current.label}
      ariaLabel="Filter issues by year"
      size="md"
      // Full-width on a phone; its natural pill width once the row fits.
      className="w-full justify-between sm:w-auto sm:justify-start"
      items={options.map((o) => ({
        key: o.value === null ? "all" : String(o.value),
        value: o.value,
        content: o.label,
      }))}
      value={year}
      onSelect={(next) =>
        go({ year: next === null ? null : String(next), page: null })
      }
    />
  );
}
