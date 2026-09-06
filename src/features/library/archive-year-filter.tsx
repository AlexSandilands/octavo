import Link from "next/link";

// The archive's year filter: a row of chip links — All, then each year with
// a published issue. Plain links, so it works before any script runs: the
// choice lives in the URL (?year=), the search carries over, and a new year
// starts from its own first page. "All" is the absence of the param.
export function ArchiveYearFilter({
  year,
  years,
  query,
}: {
  /** The active year, or null for all of them. */
  year: number | null;
  years: number[];
  /** The live search, kept on every chip. */
  query: string;
}) {
  const href = (y: number | null) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (y !== null) params.set("year", String(y));
    const qs = params.toString();
    return qs ? `/archive?${qs}` : "/archive";
  };
  const chips = [
    { key: "all", value: null, label: "All years" },
    ...years.map((y) => ({ key: String(y), value: y, label: String(y) })),
  ];
  return (
    <nav
      aria-label="Filter by year"
      className="scrollbar-soft -mx-3 overflow-x-auto px-3 pb-1 sm:-mx-4 sm:px-4"
    >
      <ul className="flex gap-2">
        {chips.map((c) => {
          const on = c.value === year;
          return (
            <li key={c.key} className="flex-none">
              <Link
                href={href(c.value)}
                aria-current={on ? "page" : undefined}
                className={`flex h-11 items-center rounded-full px-4 font-ui text-[15px] font-bold whitespace-nowrap transition-colors ${
                  on
                    ? "bg-primary text-surface"
                    : "border-edge bg-surface text-fg hover:border-primary hover:bg-primary-wash hover:text-primary border-[1.5px]"
                }`}
              >
                {c.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
