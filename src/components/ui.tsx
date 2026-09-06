import Link from "next/link";
import { forwardRef, type ReactNode } from "react";
import { Icon, type IconName } from "./icons";
import { MagazineName } from "./branding";

// The Broadsheet house set. Black ink on white paper, one signature red, rules
// instead of shadows, 2px corners, and everything said in words: a status is a
// boxed label, a button carries its label, an icon only ever sits beside one.

// The nameplate: the magazine's name in the display serif, set heavy.
export function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <span
      className="font-display text-lead"
      style={{ fontSize: size, fontWeight: 700, letterSpacing: "-0.01em" }}
    >
      <MagazineName />
    </span>
  );
}

// Tracked small caps in the signature red — the eyebrow over a headline.
export function Kicker({ children }: { children: ReactNode }) {
  return <div className="small-caps text-red">{children}</div>;
}

// Tracked small caps in grey — a section head, a table head, a form label.
export function Label({ children }: { children: ReactNode }) {
  return <div className="small-caps text-grey-soft">{children}</div>;
}

type ButtonProps = {
  children: ReactNode;
  href?: string;
  icon?: IconName;
  /** Which side the icon sits on. Defaults to trailing the label. */
  iconPosition?: "left" | "right";
  /** primary: the red box. secondary: an ink-outlined white box. danger: the
   * ink box (destructive — the wording does the warning, not a colour). link:
   * an underlined text button for row actions, with the same tap target. */
  variant?: "primary" | "secondary" | "danger" | "link";
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
// feedback — a colour change on hover, a slight press (skipped under
// prefers-reduced-motion) and the global focus ring — and every variant drops
// all of it while disabled or busy (issue #117). forwardRef so callers that
// manage focus (e.g. the confirm dialog) can target the underlying <button>.
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
    const isLink = variant === "link";
    const base = `${full ? "flex w-full" : "inline-flex"} items-center justify-center gap-2 rounded-ui font-ui font-semibold whitespace-nowrap transition-[background-color,border-color,color,text-decoration-color] duration-150 ease-out select-none`;
    const sizes = isLink
      ? { md: "min-h-11 px-1 text-[16px]", sm: "min-h-10 px-1 text-[15px]" }[
          size
        ]
      : { md: "h-12 px-5 text-[16px]", sm: "h-10 px-3.5 text-[15px]" }[size];
    const rest = {
      primary: "border border-red bg-red text-sheet",
      secondary: "border border-lead bg-sheet text-lead",
      danger: "border border-lead bg-lead text-sheet",
      link: "text-red underline decoration-1 underline-offset-4",
    }[variant];
    const feedback = {
      primary: "hover:border-red-deep hover:bg-red-deep",
      secondary: "hover:bg-newsprint active:bg-newsprint-deep",
      danger: "hover:bg-grey hover:border-grey",
      link: "hover:text-red-deep hover:decoration-2",
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
      : `cursor-pointer ${isLink ? "" : "motion-safe:active:translate-y-px"} ${feedback}`;
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

// The icon-only companion to Button, for the dialogs' close × — the one place
// an icon stands alone, and it keeps its accessible name. Same contract: pointer
// cursor, a hover wash, the focus ring. The padding grows the tap target while
// the matching negative margin cancels it in flow.
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
      className={`text-grey -m-2.5 inline-flex h-11 w-11 items-center justify-center rounded-ui transition-[background-color,color] duration-150 ${state} ${className}`}
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

// Status is a word in a thin-ruled box. The settled states are ink; the
// resting ones (a draft, someone unsubscribed) sit a step lighter; the two
// that want attention carry the one red dot the system allows.
const BOX: Record<Status, { box: string; dot: boolean }> = {
  Published: { box: "border-lead text-lead", dot: false },
  Subscribed: { box: "border-lead text-lead", dot: false },
  Draft: { box: "border-hairline-strong text-grey", dot: false },
  Unsubscribed: { box: "border-hairline-strong text-grey", dot: false },
  Bounced: { box: "border-lead text-lead", dot: true },
  Planned: { box: "border-lead text-lead", dot: true },
};

export function Pill({ status }: { status: Status }) {
  const p = BOX[status];
  return (
    <span
      className={`small-caps inline-flex h-7 items-center gap-1.5 border px-2 ${p.box}`}
    >
      {p.dot && <span aria-hidden className="bg-red h-2 w-2 rounded-full" />}
      {status}
    </span>
  );
}

// A member's initials in a ruled square — the newspaper's answer to a photo.
export function Avatar({ initials }: { initials: string }) {
  return (
    <span className="border-lead text-lead flex h-9 w-9 flex-none items-center justify-center border font-ui text-[13px] font-bold tracking-[0.06em]">
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
      className={`photo-fill-green flex flex-col justify-between ${pad} ${className}`}
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

// A boxed notice: a sentence with a rule down its left edge. `tone` picks the
// rule — red for something that went wrong, ink for information or success.
export function Notice({
  tone = "info",
  role,
  className = "",
  children,
}: {
  tone?: "info" | "error";
  role?: "alert" | "status";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role={role}
      className={`border-hairline-strong bg-sheet border border-l-4 px-4 py-3 font-ui text-[16px] leading-relaxed ${
        tone === "error" ? "border-l-red" : "border-l-lead"
      } ${className}`}
    >
      {children}
    </div>
  );
}

export { Icon };
