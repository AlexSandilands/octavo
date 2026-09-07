import Link from "next/link";
import { forwardRef, type ReactNode } from "react";
import { Icon, type IconName } from "./icons";

export { Avatar, Kicker, Label, Pill, Wordmark } from "./ui-marks";
export type { Status, Tone } from "./ui-marks";
export { Icon };

// Every control names the surface it sits on: "paper" (a light sheet, card or
// dialog) or "dark" (the chrome — bars, rails, the ground). The two differ only
// in the secondary/ghost colours; a brass primary is brass on both.
export type ButtonTone = "paper" | "dark";

type ButtonProps = {
  children: ReactNode;
  href?: string;
  icon?: IconName;
  /** Which side the icon sits on. Defaults to trailing the label. */
  iconPosition?: "left" | "right";
  variant?: "primary" | "secondary" | "danger" | "ghost";
  tone?: ButtonTone;
  /** "md" is the standalone CTA size; "sm" fits dense bars; "lg" is a hero. */
  size?: "md" | "sm" | "lg";
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
  "aria-pressed"?: boolean;
  title?: string;
  target?: "_blank";
};

const SIZES = {
  lg: "h-14 px-7 text-[17px]",
  md: "h-12 px-5 text-[16px]",
  sm: "h-10 px-4 text-[15px]",
} as const;

// Fills and hover feedback, per variant and tone. The primary is brass with
// charcoal text on either ground; the secondary is an outline in the surface's
// own ink; ghost is text only with a wash on hover.
const LOOK: Record<
  NonNullable<ButtonProps["variant"]>,
  Record<ButtonTone, { rest: string; feedback: string }>
> = {
  primary: {
    paper: { rest: "bg-brass text-ground", feedback: "hover:bg-brass-strong" },
    dark: { rest: "bg-brass text-ground", feedback: "hover:bg-brass-strong" },
  },
  secondary: {
    paper: {
      rest: "border-[1.5px] border-hair-warm bg-white text-ink",
      feedback: "hover:border-brass-ink hover:bg-brass-wash",
    },
    dark: {
      rest: "border-[1.5px] border-chrome-muted text-chrome-text",
      feedback: "hover:border-chrome-text hover:bg-lifted",
    },
  },
  danger: {
    paper: { rest: "bg-danger text-paper", feedback: "hover:bg-danger-strong" },
    dark: { rest: "bg-danger text-paper", feedback: "hover:bg-danger-strong" },
  },
  ghost: {
    paper: {
      rest: "text-brass-ink",
      feedback: "hover:bg-brass-wash hover:text-brass-ink-strong",
    },
    dark: { rest: "text-chrome-text", feedback: "hover:bg-lifted" },
  },
};

// The one button for the app. Every variant shares the same interaction
// feedback — a hover shift, a tactile press (a slight scale-down, skipped under
// prefers-reduced-motion) and the focus-visible ring — so buttons feel
// consistent everywhere (issue #64), and every variant drops all of it while
// disabled or busy (issue #117). forwardRef so callers that manage focus (e.g.
// the confirm dialog) can target the underlying <button>.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      children,
      href,
      icon,
      iconPosition = "right",
      variant = "primary",
      tone = "paper",
      size = "md",
      full = false,
      onClick,
      type = "button",
      disabled = false,
      unavailable = false,
      busy = false,
      className = "",
      "aria-label": ariaLabel,
      "aria-pressed": ariaPressed,
      title,
      target,
    },
    ref,
  ) {
    const isDisabled = disabled || busy;
    // Every way of being unpressable, for the styling and the click guard —
    // `unavailable` has no attribute doing either of those for it.
    const inert = isDisabled || unavailable;
    const base = `${full ? "flex w-full" : "inline-flex"} rounded-ui items-center justify-center gap-2 font-ui font-semibold whitespace-nowrap transition-[transform,background-color,border-color,color] duration-150 ease-out select-none`;
    const look = LOOK[variant][tone];
    // The hover/press feedback is composed in only when the button can actually
    // be pressed, so a disabled or busy one sits completely still. Gated here in
    // JS rather than with Tailwind's `enabled:` variant: `:enabled` never matches
    // an <a>, so that would silently kill hover on the link branch below — nor
    // would it match an `unavailable` button, which is enabled and shouldn't be.
    const state = inert
      ? busy
        ? "cursor-default"
        : "cursor-default opacity-50"
      : `cursor-pointer motion-safe:active:scale-[0.97] ${look.feedback}`;
    const cls = `${base} ${SIZES[size]} ${look.rest} ${state} ${className}`;
    const iconEl = icon && <Icon name={icon} size={18} strokeWidth={1.8} />;
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
        <Link
          href={href}
          className={cls}
          aria-label={ariaLabel}
          title={title}
          target={target}
        >
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
        aria-pressed={ariaPressed}
        title={title}
        className={cls}
      >
        {inner}
      </button>
    );
  },
);

// The icon button: a 44px square target with an accessible name, and — where
// there is room — the name printed beside the icon (`showLabel`), because an
// icon alone says nothing to this audience. It carries the same interaction
// contract as Button: pointer cursor, a hover wash, the focus ring, and a
// disabled state that promises nothing. `danger` turns the wash red for
// destructive row actions.
export const IconButton = forwardRef<
  HTMLButtonElement,
  {
    icon: IconName;
    /** Accessible name — an icon alone says nothing. */
    label: string;
    /** Print a word beside the icon. */
    showLabel?: boolean;
    /** The word printed, when it should differ from the accessible name
     * ("Delete" beside the icon; "Delete Spring Notes" for the reader). */
    text?: string;
    onClick?: () => void;
    size?: number;
    tone?: ButtonTone;
    danger?: boolean;
    disabled?: boolean;
    title?: string;
    className?: string;
    "aria-expanded"?: boolean;
    "aria-controls"?: string;
    "aria-pressed"?: boolean;
  }
>(function IconButton(
  {
    icon,
    label,
    showLabel = false,
    text,
    onClick,
    size = 20,
    tone = "paper",
    danger = false,
    disabled = false,
    title,
    className = "",
    "aria-expanded": ariaExpanded,
    "aria-controls": ariaControls,
    "aria-pressed": ariaPressed,
  },
  ref,
) {
  const colour =
    tone === "dark"
      ? danger
        ? "text-chrome-muted hover:bg-lifted hover:text-danger-bright"
        : "text-chrome-text hover:bg-lifted"
      : danger
        ? "text-muted hover:bg-danger-soft hover:text-danger"
        : "text-muted hover:bg-brass-wash hover:text-ink";
  // Same disabled treatment as Button: dimmed, no pointer, and the hover wash
  // composed out entirely so it promises nothing it will not do (issue #117).
  const state = disabled
    ? `cursor-default opacity-50 ${tone === "dark" ? "text-chrome-muted" : "text-muted"}`
    : `cursor-pointer ${colour}`;
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      aria-pressed={ariaPressed}
      title={title ?? (showLabel ? undefined : label)}
      className={`rounded-ui inline-flex h-11 min-w-11 items-center justify-center gap-1.5 font-ui text-[15px] font-medium transition-[background-color,color] duration-150 ${showLabel ? "px-3" : ""} ${state} ${className}`}
    >
      <Icon name={icon} size={size} strokeWidth={1.7} />
      {showLabel && <span>{text ?? label}</span>}
    </button>
  );
});

// The one text field for the app's forms — a white box on a paper sheet, the
// brass-ink border on focus. Callers add only width/height overrides.
export const FIELD =
  "border-hair-warm text-ink rounded-ui h-12 w-full border-[1.5px] bg-white px-3.5 font-ui text-[16px] outline-none focus:border-brass-ink";

// A field's printed name: the mono shelf-tag label, as a <label>.
export function FieldLabel({
  htmlFor,
  children,
  className = "",
}: {
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={`text-faint mb-1.5 block font-meta text-[12px] font-medium tracking-[0.14em] uppercase ${className}`}
    >
      {children}
    </label>
  );
}
