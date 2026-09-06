import Link from "next/link";
import { forwardRef, type ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import { MagazineName } from "./branding";

export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <span
      className="font-display text-lead"
      style={{ fontSize: size, fontWeight: 500, letterSpacing: ".02em" }}
    >
      <MagazineName />
    </span>
  );
}

export function Kicker({ children }: { children: ReactNode }) {
  return (
    <div className="font-ui text-[11px] font-semibold tracking-[0.2em] text-red uppercase">
      {children}
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <div className="font-ui text-[11px] font-semibold tracking-[0.2em] text-grey-soft uppercase">
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

// The one button for the app. Every variant shares the same interaction
// feedback — a hover lift, a tactile press (a slight scale-down, skipped under
// prefers-reduced-motion) and the global focus-visible ring — so buttons feel
// consistent and responsive everywhere (issue #64), and every variant drops all
// of it while disabled or busy (issue #117). forwardRef so callers that manage
// focus (e.g. the confirm dialog) can target the underlying <button>.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
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
      unavailable = false,
      busy = false,
      className = "",
      "aria-label": ariaLabel,
      title,
    },
    ref,
  ) {
    const isDisabled = disabled || busy;
    // Every way of being unpressable, for the styling and the click guard —
    // `unavailable` has no attribute doing either of those for it.
    const inert = isDisabled || unavailable;
    const base = `${full ? "flex w-full" : "inline-flex"} items-center justify-center gap-2 rounded-ui font-ui font-semibold transition-[transform,background-color,border-color,box-shadow,color] duration-150 ease-out select-none`;
    const sizes = {
      md: "h-12 px-5 text-[15px]",
      sm: "h-10 px-4 text-sm",
    }[size];
    const rest = {
      primary: "bg-red text-sheet",
      // The house style for white buttons: a hairline on white.
      secondary: "border-[1.5px] border-hairline bg-white text-lead",
      danger: "bg-red text-sheet",
    }[variant];
    const feedback = {
      primary:
        "hover:bg-red-deep",
      // That hairline lights up to an accent outline over a faint wash (matches
      // the editor toolbar / sponsor buttons the rest of the app already uses).
      secondary:
        "hover:border-red hover:bg-newsprint active:bg-newsprint",
      danger:
        "hover:bg-red-deep",
    }[variant];
    // The hover/press feedback is composed in only when the button can actually
    // be pressed, so a disabled or busy one sits completely still. Gated here in
    // JS rather than with Tailwind's `enabled:` variant: `:enabled` never matches
    // an <a>, so that would silently kill hover on the link branch below — nor
    // would it match an `unavailable` button, which is enabled and shouldn't be.
    const state = inert
      ? busy
        ? "cursor-default"
        : "cursor-default opacity-50"
      : `cursor-pointer motion-safe:active:scale-[0.97] ${feedback}`;
    const cls = `${base} ${sizes} ${rest} ${state} ${className}`;
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
        // Dropping the handler is what makes `unavailable` inert, for the mouse
        // and for Enter/Space alike; there is no attribute doing it.
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

// The icon-only companion to Button, for the dialogs' close ×. It carries the
// same interaction contract — pointer cursor, a hover wash, the focus ring —
// without Button's box: the padding grows the tap target while the matching
// negative margin cancels it in flow, so the icon sits exactly where it did.
export const IconButton = forwardRef<
  HTMLButtonElement,
  {
    icon: IconName;
    /** Accessible name — an icon alone says nothing. */
    label: string;
    onClick?: () => void;
    size?: number;
    disabled?: boolean;
    className?: string;
  }
>(function IconButton(
  { icon, label, onClick, size = 22, disabled = false, className = "" },
  ref,
) {
  // Same disabled treatment as Button: dimmed, no pointer, and the hover wash
  // composed out entirely so it promises nothing it will not do (issue #117).
  const state = disabled
    ? "cursor-default opacity-50"
    : "hover:bg-newsprint hover:text-lead cursor-pointer";
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`text-grey -m-2 inline-flex items-center justify-center rounded-ui p-2 transition-[background-color,color] duration-150 ${state} ${className}`}
    >
      <Icon name={icon} size={size} strokeWidth={1.7} />
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
  Published: { bg: "bg-newsprint", ink: "text-red", dot: "bg-red" },
  Subscribed: { bg: "bg-newsprint", ink: "text-red", dot: "bg-lead" },
  Draft: { bg: "bg-newsprint", ink: "text-grey-soft", dot: "bg-hairline-strong" },
  Unsubscribed: { bg: "bg-newsprint", ink: "text-grey-soft", dot: "bg-hairline-strong" },
  Bounced: { bg: "bg-newsprint", ink: "text-red", dot: "bg-red" },
  Planned: { bg: "bg-newsprint", ink: "text-red", dot: "bg-red" },
};

export function Pill({ status }: { status: Status }) {
  const p = PILL[status];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${p.bg}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} />
      <span className={`font-ui text-xs font-semibold ${p.ink}`}>
        {status}
      </span>
    </span>
  );
}

export function Avatar({ initials }: { initials: string }) {
  return (
    <span className="bg-newsprint text-red flex h-9 w-9 flex-none items-center justify-center rounded-full font-ui text-[13px] font-semibold">
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
      <div className="text-sheet font-display text-xs tracking-[0.1em]">
        <MagazineName /> · No. {no}
      </div>
      <div className={`text-sheet font-display leading-[0.98] ${titleSize}`}>
        {title}
      </div>
    </div>
  );
}

export { Icon };
