import Link from "next/link";
import { forwardRef, type ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import { MagazineName } from "./branding";
import { BOOK_MARK_PATHS, BOOK_MARK_VIEWBOX } from "@/lib/brands";

// The house set for the Compass chrome: one wordmark, two labels, one button,
// one icon button, the status pill and the neutral chip, the avatar and the
// fallback cover. Every interactive control in the app is built from these.

// The magazine's name beside the book mark — the app's identity in every bar.
export function Wordmark({
  size = 22,
  mark = true,
}: {
  size?: number;
  /** The cobalt book tile before the name; off where only the name fits. */
  mark?: boolean;
}) {
  return (
    <span className="text-fg inline-flex items-center gap-2.5">
      {mark && <BookMark size={Math.round(size * 1.35)} />}
      <span
        className="font-ui font-bold"
        style={{ fontSize: size, letterSpacing: "-0.01em" }}
      >
        <MagazineName />
      </span>
    </span>
  );
}

// The octavo book mark on a rounded primary tile — the favicon, in the page.
export function BookMark({ size = 30 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="bg-primary text-surface inline-flex flex-none items-center justify-center"
      style={{ width: size, height: size, borderRadius: size * 0.28 }}
    >
      <svg
        width={size * 0.78}
        height={size * 0.78}
        viewBox={BOOK_MARK_VIEWBOX}
        fill="currentColor"
      >
        {BOOK_MARK_PATHS.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </span>
  );
}

export function Kicker({ children }: { children: ReactNode }) {
  return (
    <div className="text-primary font-ui text-[13px] font-bold tracking-[0.12em] uppercase">
      {children}
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <div className="text-fg-muted font-ui text-[13px] font-bold tracking-[0.12em] uppercase">
      {children}
    </div>
  );
}

type ButtonProps = {
  children: ReactNode;
  href?: string;
  icon?: IconName;
  /** Which side the icon sits on. Defaults to leading the label. */
  iconPosition?: "left" | "right";
  variant?: "primary" | "secondary" | "danger" | "quiet";
  /** "md" is the everyday pill; "lg" the hero CTA; "sm" fits dense bars. */
  size?: "lg" | "md" | "sm";
  full?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  /** Nothing left to do here, but the control stays reachable: it looks and
   * behaves exactly like `disabled` without the attribute, so it keeps its
   * place in the tab order and — the point — doesn't throw keyboard focus to
   * <body> the moment it applies to the button someone is standing on (issue
   * #131). Reach for it when a control switches off under the user's hands;
   * plain `disabled` is still right for one that starts off. Buttons only. */
  unavailable?: boolean;
  /** A working/loading state: disables the button but keeps it looking active
   * (no dimming) so a spinner or "Working…" label reads clearly. */
  busy?: boolean;
  className?: string;
  "aria-label"?: string;
  title?: string;
};

// The one button for the app: a pill. Every variant shares the same feedback —
// a hover shade, a tactile press (skipped under prefers-reduced-motion) and the
// global focus ring — and every variant drops all of it while disabled or busy
// (issue #117). forwardRef so callers that manage focus can target the button.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      children,
      href,
      icon,
      iconPosition = "left",
      variant = "primary",
      size = "md",
      full = false,
      onClick,
      type = "button",
      disabled = false,
      unavailable = false,
      busy = false,
      className = "",
      "aria-label": ariaLabel,
      title,
    },
    ref,
  ) {
    const isDisabled = disabled || busy;
    const inert = isDisabled || unavailable;
    const base = `${full ? "flex w-full" : "inline-flex"} items-center justify-center gap-2 rounded-full font-ui font-bold whitespace-nowrap transition-[transform,background-color,border-color,box-shadow,color] duration-150 ease-out select-none`;
    const sizes = {
      lg: "h-14 px-7 text-[18px]",
      md: "h-12 px-5 text-[16px]",
      sm: "h-10 px-4 text-[15px]",
    }[size];
    const rest = {
      primary: "bg-primary text-surface shadow-fab",
      secondary: "border-edge bg-surface text-fg border-[1.5px]",
      danger: "bg-danger text-surface",
      quiet: "text-primary bg-transparent",
    }[variant];
    const feedback = {
      primary: "hover:bg-primary-strong",
      secondary:
        "hover:border-primary hover:bg-primary-wash hover:text-primary",
      danger: "hover:bg-danger-strong",
      quiet: "hover:bg-primary-wash",
    }[variant];
    // Gated in JS rather than with Tailwind's `enabled:` variant: `:enabled`
    // never matches an <a>, nor an `unavailable` button that is enabled.
    const state = inert
      ? busy
        ? "cursor-default"
        : "cursor-default opacity-50"
      : `cursor-pointer motion-safe:active:scale-[0.97] ${feedback}`;
    const cls = `${base} ${sizes} ${rest} ${state} ${className}`;
    const iconEl = icon && (
      <Icon name={icon} size={size === "sm" ? 17 : 19} strokeWidth={2} />
    );
    const inner = (
      <>
        {iconPosition === "left" && iconEl}
        {children}
        {iconPosition === "right" && iconEl}
      </>
    );
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
        onClick={inert ? undefined : onClick}
        disabled={isDisabled}
        aria-disabled={unavailable || undefined}
        aria-label={ariaLabel}
        title={title}
        className={cls}
      >
        {inner}
      </button>
    );
  },
);

// The round icon-only companion to Button. Always a 44px (or larger) target,
// always named — the label is both the accessible name and the tooltip.
export const IconButton = forwardRef<
  HTMLButtonElement,
  {
    icon: IconName;
    /** Accessible name — an icon alone says nothing. Doubles as the tooltip. */
    label: string;
    onClick?: () => void;
    href?: string;
    /** Icon size; the target is always at least 44px. */
    size?: number;
    /** "quiet" sits flat on its surface; "outlined" has a border; "solid" is
     * primary on a white disc with a lift — the reader's page-turn buttons. */
    variant?: "quiet" | "outlined" | "solid" | "danger";
    /** Target diameter in px (min 44). */
    box?: number;
    disabled?: boolean;
    pressed?: boolean;
    className?: string;
  }
>(function IconButton(
  {
    icon,
    label,
    onClick,
    href,
    size = 22,
    variant = "quiet",
    box = 44,
    disabled = false,
    pressed,
    className = "",
  },
  ref,
) {
  const look = {
    quiet: "text-fg-muted",
    outlined: "border-edge bg-surface text-fg border-[1.5px]",
    solid: "bg-surface text-primary shadow-float",
    danger: "text-danger",
  }[variant];
  const hover = {
    quiet: "hover:bg-primary-wash hover:text-primary",
    outlined: "hover:border-primary hover:bg-primary-wash hover:text-primary",
    solid: "hover:bg-primary-wash",
    danger: "hover:bg-danger-soft",
  }[variant];
  const state = disabled
    ? "cursor-default opacity-50"
    : `cursor-pointer motion-safe:active:scale-[0.95] ${hover}`;
  const cls = `inline-flex flex-none items-center justify-center rounded-full transition-[background-color,color,border-color,transform] duration-150 ${look} ${pressed ? "bg-primary-soft text-primary" : ""} ${state} ${className}`;
  const style = { width: Math.max(44, box), height: Math.max(44, box) };
  const inner = <Icon name={icon} size={size} strokeWidth={1.9} />;
  if (href)
    return (
      <Link
        href={href}
        aria-label={label}
        title={label}
        className={cls}
        style={style}
      >
        {inner}
      </Link>
    );
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      className={cls}
      style={style}
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
  Published: { bg: "bg-ok-soft", ink: "text-ok", dot: "bg-ok" },
  Subscribed: { bg: "bg-ok-soft", ink: "text-ok", dot: "bg-ok" },
  Draft: { bg: "bg-surface-2", ink: "text-fg-muted", dot: "bg-edge" },
  Unsubscribed: { bg: "bg-surface-2", ink: "text-fg-muted", dot: "bg-edge" },
  Bounced: { bg: "bg-warn-soft", ink: "text-warn", dot: "bg-warn" },
  Planned: { bg: "bg-warn-soft", ink: "text-warn", dot: "bg-warn" },
};

// A status pill: a dot and a word, tinted by meaning.
export function Pill({ status }: { status: Status }) {
  const p = PILL[status];
  return (
    <span
      className={`inline-flex h-8 items-center gap-2 rounded-full px-3 ${p.bg}`}
    >
      <span className={`h-2 w-2 rounded-full ${p.dot}`} />
      <span className={`font-ui text-[14px] font-bold ${p.ink}`}>{status}</span>
    </span>
  );
}

// A neutral chip: a section name on the latest-issue card, a count, a year.
export function Chip({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "primary";
  className?: string;
}) {
  const look =
    tone === "primary"
      ? "bg-primary-soft text-primary"
      : "bg-surface-2 text-fg-muted";
  return (
    <span
      className={`inline-flex h-8 max-w-full items-center rounded-full px-3 font-ui text-[14px] font-bold ${look} ${className}`}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

export function Avatar({
  initials,
  size = 40,
}: {
  initials: string;
  size?: number;
}) {
  return (
    <span
      className="bg-primary-soft text-primary flex flex-none items-center justify-center rounded-full font-ui font-bold"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {initials}
    </span>
  );
}

// The striped magazine cover used for thumbnails and heroes with no cover page.
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
        <MagazineName /> · No. {no}
      </div>
      <div className={`text-paper font-serif leading-[0.98] ${titleSize}`}>
        {title}
      </div>
    </div>
  );
}

export { Icon };
