import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "./icons";

// The admin lists' rows: cards on a phone, one rounded table card from md up.
// Each row is a card below md (`ROW_CLASS` turns the card chrome off at md,
// where the container supplies it and the rows become hover-tinted lines).
export function ListRows({ children }: { children: ReactNode }) {
  return (
    <div className="md:bg-surface md:border-hairline md:shadow-card md:divide-hairline flex flex-col gap-3 md:block md:divide-y md:rounded-card md:border">
      {children}
    </div>
  );
}

export const ROW_CLASS =
  "bg-surface border-hairline shadow-card rounded-card border p-3 transition-colors md:rounded-none md:border-0 md:shadow-none md:px-4 md:py-3 md:hover:bg-primary-wash";

// The uppercase column labels above a table card (md+ only; a phone's cards
// label themselves).
export function ColumnHeader({ children }: { children: ReactNode }) {
  return (
    <div className="text-fg-muted mt-4 hidden flex-none items-center px-4 pb-2 font-ui text-[12px] font-bold tracking-[0.1em] uppercase md:flex">
      {children}
    </div>
  );
}

// A row's action: a round icon target on a phone, icon + visible label from
// md. One element, so its accessible name never changes and a tooltip is
// always there. `tone: danger` is for delete/remove.
export function RowAction({
  icon,
  label,
  ariaLabel,
  onClick,
  href,
  disabled = false,
  tone = "primary",
  title,
}: {
  icon: IconName;
  /** The visible word at md+. */
  label: string;
  /** The full accessible name, e.g. "Delete Spring issue". */
  ariaLabel: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  tone?: "primary" | "danger" | "quiet";
  /** Tooltip; defaults to the accessible name. */
  title?: string;
}) {
  const look = {
    primary: "text-primary hover:bg-primary-wash",
    danger: "text-fg-muted hover:bg-danger-soft hover:text-danger",
    quiet: "text-fg-muted hover:bg-primary-wash hover:text-primary",
  }[tone];
  const cls = `inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-2.5 font-ui text-[15px] font-bold transition-colors md:px-3 ${
    disabled ? "cursor-default opacity-40" : `cursor-pointer ${look}`
  }`;
  const inner = (
    <>
      <Icon name={icon} size={20} strokeWidth={1.9} />
      <span className="hidden md:inline">{label}</span>
    </>
  );
  if (href && !disabled)
    return (
      <Link
        href={href}
        aria-label={ariaLabel}
        title={title ?? ariaLabel}
        className={cls}
      >
        {inner}
      </Link>
    );
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title ?? ariaLabel}
      className={cls}
    >
      {inner}
    </button>
  );
}

// A quiet text action inside a bulk bar ("Clear", "Select all 40 matching").
export function TextAction({
  children,
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-primary hover:bg-primary-wash inline-flex h-11 cursor-pointer items-center rounded-full px-3 font-ui text-[15px] font-bold transition-colors disabled:cursor-default disabled:opacity-50"
    >
      {children}
    </button>
  );
}

// The empty-result line inside a list region.
export const EMPTY_RESULT_CLASS =
  "text-fg-muted bg-surface border-hairline rounded-card border px-6 py-12 text-center font-ui text-[17px] md:mt-4";
