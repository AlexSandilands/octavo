import type { ReactNode } from "react";
import { IconButton } from "./ui";

// The furniture every Broadsheet dialog shares, so seven dialogs can't drift:
// a display-serif title (optionally under a red kicker, with the close × at the
// right), and a button row under a rule. The panel itself comes from
// `dialogPanel()` in dialog-shell.tsx; a dialog composes these inside it.

export function DialogTitle({
  id,
  kicker,
  onClose,
  closeDisabled = false,
  children,
}: {
  /** The id DialogShell hands out — `aria-labelledby` resolves to this. */
  id: string;
  kicker?: string;
  /** Renders the close × when given. */
  onClose?: () => void;
  closeDisabled?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        {kicker && <div className="small-caps text-red mb-2">{kicker}</div>}
        <h2
          id={id}
          className="text-lead font-display text-[27px] leading-[1.15] font-semibold text-balance"
        >
          {children}
        </h2>
      </div>
      {onClose && (
        <IconButton
          icon="close"
          label="Close"
          onClick={onClose}
          disabled={closeDisabled}
          className="mt-0.5 flex-none"
        />
      )}
    </div>
  );
}

// The button row: a rule above, actions at the right, the primary last.
export function DialogFooter({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rule-heavy mt-7 flex flex-wrap items-center justify-end gap-3 px-7 pt-4 pb-6 ${className}`}
    >
      {children}
    </div>
  );
}

// A labelled field: small-caps caption, the control, an optional hint under it.
export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="small-caps text-grey-soft">
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-grey-soft font-ui text-[14px] leading-snug">{hint}</p>
      )}
    </div>
  );
}

// The one text input: ink border on white, 2px corners, a red ring on focus
// (from the global focus-visible rule).
export const INPUT_CLASS =
  "border-lead bg-sheet text-lead placeholder:text-grey-soft h-12 w-full rounded-ui border px-3.5 font-ui text-[17px]";
