import Link from "next/link";
import { forwardRef, type ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import { site } from "@/lib/site";

export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <span
      className="font-serif text-ink"
      style={{ fontSize: size, fontWeight: 500, letterSpacing: ".02em" }}
    >
      {site.name}
    </span>
  );
}

export function Kicker({ children }: { children: ReactNode }) {
  return (
    <div className="font-sans text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
      {children}
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <div className="font-sans text-[11px] font-semibold tracking-[0.2em] text-faint uppercase">
      {children}
    </div>
  );
}

type ButtonProps = {
  children: ReactNode;
  href?: string;
  icon?: IconName;
  /** Which side the icon sits on. Defaults to trailing the label. */
  iconPosition?: "left" | "right";
  variant?: "primary" | "secondary" | "danger";
  /** "md" is the standalone CTA size; "sm" fits dense bars (editor header). */
  size?: "md" | "sm";
  full?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  /** A working/loading state: disables the button but keeps it looking active
   * (no dimming) so a spinner or "Working…" label reads clearly. */
  busy?: boolean;
  className?: string;
  "aria-label"?: string;
  title?: string;
};

// The one button for the app. Every variant shares the same interaction
// feedback — a hover lift, a tactile press (a slight scale-down, skipped under
// prefers-reduced-motion) and the global focus-visible ring — so buttons feel
// consistent and responsive everywhere (issue #64). forwardRef so callers that
// manage focus (e.g. the confirm dialog) can target the underlying <button>.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    href,
    icon,
    iconPosition = "right",
    variant = "primary",
    size = "md",
    full = false,
    onClick,
    type = "button",
    disabled = false,
    busy = false,
    className = "",
    "aria-label": ariaLabel,
    title,
  },
  ref,
) {
  const isDisabled = disabled || busy;
  const base = `${full ? "flex w-full" : "inline-flex"} items-center justify-center gap-2 rounded-lg font-sans font-semibold transition-[transform,background-color,border-color,box-shadow,color] duration-150 ease-out select-none motion-safe:active:scale-[0.97]`;
  const sizes = {
    md: "h-12 px-5 text-[15px]",
    sm: "h-10 px-4 text-sm",
  }[size];
  const styles = {
    primary:
      "bg-accent text-paper shadow-[0_2px_8px_rgba(29,77,62,0.25)] hover:bg-accent-strong hover:shadow-[0_4px_14px_rgba(29,77,62,0.3)] active:shadow-[0_1px_4px_rgba(29,77,62,0.25)]",
    // The house style for white buttons: a hairline that lights up to an accent
    // outline over a faint wash on hover (matches the editor toolbar / sponsor
    // buttons the rest of the app already uses).
    secondary:
      "border-[1.5px] border-hair-warm bg-white text-ink hover:border-accent hover:bg-accent-wash active:bg-accent-wash",
    danger:
      "bg-warn text-paper shadow-[0_2px_10px_rgba(0,0,0,0.18)] hover:bg-warn-strong hover:shadow-[0_4px_14px_rgba(0,0,0,0.22)] active:shadow-[0_1px_5px_rgba(0,0,0,0.18)]",
  }[variant];
  const state = isDisabled
    ? busy
      ? "cursor-default"
      : "cursor-default opacity-50"
    : "cursor-pointer";
  const cls = `${base} ${sizes} ${styles} ${state} ${className}`;
  const iconEl = icon && <Icon name={icon} size={17} strokeWidth={1.8} />;
  const inner = (
    <>
      {iconPosition === "left" && iconEl}
      {children}
      {iconPosition === "right" && iconEl}
    </>
  );
  // A disabled link is not a real thing; only the button branch can disable.
  if (href)
    return (
      <Link href={href} className={cls} aria-label={ariaLabel} title={title}>
        {inner}
      </Link>
    );
  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      aria-label={ariaLabel}
      title={title}
      className={cls}
    >
      {inner}
    </button>
  );
});

export type Status =
  | "Published"
  | "Draft"
  | "Subscribed"
  | "Unsubscribed"
  | "Bounced"
  | "Planned";

const PILL: Record<Status, { bg: string; ink: string; dot: string }> = {
  Published: { bg: "bg-tint", ink: "text-accent", dot: "bg-accent" },
  Subscribed: { bg: "bg-tint", ink: "text-accent", dot: "bg-ok" },
  Draft: { bg: "bg-chip", ink: "text-faint", dot: "bg-chip-dot" },
  Unsubscribed: { bg: "bg-chip", ink: "text-faint", dot: "bg-chip-dot" },
  Bounced: { bg: "bg-warn-soft", ink: "text-warn", dot: "bg-alert" },
  Planned: { bg: "bg-warn-soft", ink: "text-warn", dot: "bg-alert" },
};

export function Pill({ status }: { status: Status }) {
  const p = PILL[status];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${p.bg}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} />
      <span className={`font-sans text-xs font-semibold ${p.ink}`}>
        {status}
      </span>
    </span>
  );
}

export function Avatar({ initials }: { initials: string }) {
  return (
    <span className="bg-tint text-accent flex h-9 w-9 flex-none items-center justify-center rounded-full font-sans text-[13px] font-semibold">
      {initials}
    </span>
  );
}

// The striped magazine cover used for thumbnails and heroes.
export function Cover({
  no,
  title,
  className = "",
  size = "md",
}: {
  no: number;
  title: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const pad = size === "lg" ? "p-5" : "p-4";
  const titleSize =
    size === "lg" ? "text-4xl" : size === "md" ? "text-3xl" : "text-xl";
  return (
    <div
      className={`photo-fill-green flex flex-col justify-between rounded-[4px] ${pad} ${className}`}
    >
      <div className="text-cream font-serif text-xs tracking-[0.1em]">
        {site.name} · No. {no}
      </div>
      <div className={`text-paper font-serif leading-[0.98] ${titleSize}`}>
        {title}
      </div>
    </div>
  );
}

export { Icon };
