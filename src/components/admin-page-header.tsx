import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";

// The top of every admin page: the title, a one-line summary (whole-list
// numbers), a strip of small stat cards drawn from the same numbers, and the
// page's primary action(s) at the right (full width on a phone).
export function AdminPageHeader({
  title,
  summary,
  stats,
  actions,
}: {
  title: string;
  /** Whole-list numbers in one sentence; carries `data-list-summary`. */
  summary: ReactNode;
  stats?: { label: string; value: ReactNode; icon: IconName }[];
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-none flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-fg font-ui text-[28px] leading-tight font-bold sm:text-[32px]">
            {title}
          </h1>
          <p
            data-list-summary
            className="text-fg-muted mt-1 font-ui text-[16px]"
          >
            {summary}
          </p>
        </div>
        {actions && (
          <div className="flex flex-none flex-col gap-3 sm:flex-row [&>*]:w-full sm:[&>*]:w-auto">
            {actions}
          </div>
        )}
      </div>
      {stats && stats.length > 0 && (
        <ul className="flex flex-wrap gap-3">
          {stats.map((s) => (
            <li
              key={s.label}
              className="bg-surface border-hairline shadow-card flex min-w-[140px] flex-1 items-center gap-3 rounded-card border px-4 py-3 sm:flex-none sm:pr-6"
            >
              <span className="bg-primary-soft text-primary flex h-10 w-10 flex-none items-center justify-center rounded-full">
                <Icon name={s.icon} size={20} strokeWidth={1.9} />
              </span>
              <span className="min-w-0">
                <span className="text-fg block font-ui text-[22px] leading-none font-bold tabular-nums">
                  {s.value}
                </span>
                <span className="text-fg-muted mt-1 block font-ui text-[13px] font-bold tracking-[0.06em] uppercase">
                  {s.label}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
