import type { ReactNode } from "react";

// The furniture of an admin list page: the heading band and the table's
// small-caps header row. The rows themselves are each feature's own (they
// carry the feature's actions), but they share the zebra and the rules here.

// The page's heading: the title in the display serif, a whole-list summary
// under it (marked so the gates can read it), and the page's actions at the
// right — full width on a phone.
export function AdminPageHeader({
  title,
  summary,
  actions,
}: {
  title: string;
  summary?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-none flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-lead font-display text-[36px] leading-none font-semibold sm:text-[40px]">
          {title}
        </h1>
        {summary && (
          <p
            data-list-summary
            className="text-grey mt-2 font-ui text-[15px] tabular-nums"
          >
            {summary}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-none flex-col gap-3 sm:flex-row">
          {actions}
        </div>
      )}
    </div>
  );
}

// A table's header row: a heavy rule, the column names in small caps, a
// hairline. Hidden on a phone, where each row lays its cells out in a stack
// and names them itself. Callers give the cells the same widths their rows use.
export function TableHead({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={`rule-heavy rule-hair small-caps text-grey-soft mt-4 hidden flex-none items-center gap-x-3 px-1.5 py-2 sm:flex ${className}`}
    >
      {children}
    </div>
  );
}

// Zebra rows on the paper: every other row takes the newsprint tint. Applied to
// the element that holds the rows and nothing else.
export const ZEBRA = "[&>*:nth-child(even)]:bg-newsprint";

// One row's box: a hairline under it, the same inset as the header.
export const ROW = "border-hairline border-b px-1.5";
