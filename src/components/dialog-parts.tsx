import type { ReactNode } from "react";
import { IconButton } from "./ui";

// The parts every dialog is assembled from, so seven dialogs share one
// geometry: a header (kicker, title, optional close ×), a body column and an
// action row that stacks full-width on a phone and sits right-aligned on a
// desktop. The shell supplies the box; these supply what goes in it.

export function DialogHeader({
  titleId,
  title,
  kicker,
  onClose,
  closeDisabled = false,
}: {
  titleId: string;
  title: ReactNode;
  kicker?: string;
  /** Renders the close × when given. */
  onClose?: () => void;
  closeDisabled?: boolean;
}) {
  return (
    <div className="flex flex-none items-start justify-between gap-4 px-5 pt-5 md:px-8 md:pt-7">
      <div className="min-w-0">
        {kicker && (
          <div className="text-primary font-ui text-[13px] font-bold tracking-[0.12em] uppercase">
            {kicker}
          </div>
        )}
        <h2
          id={titleId}
          className={`text-fg font-ui text-[24px] leading-tight font-bold md:text-[26px] ${kicker ? "mt-2" : ""}`}
        >
          {title}
        </h2>
      </div>
      {onClose && (
        <IconButton
          icon="close"
          label="Close"
          onClick={onClose}
          disabled={closeDisabled}
          className="-mt-1 -mr-2"
        />
      )}
    </div>
  );
}

export function DialogBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`px-5 md:px-8 ${className}`}>{children}</div>;
}

// Full-width, primary first, on a phone (the thumb lands on the action);
// right-aligned with the safe button first on a desktop.
export function DialogActions({
  children,
  between = false,
}: {
  children: ReactNode;
  /** Spread the children apart (a destructive action at the far left). */
  between?: boolean;
}) {
  return (
    <div
      className={`flex flex-none flex-col-reverse gap-3 px-5 pt-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:flex-row md:px-8 md:pb-7 ${
        between ? "md:justify-between" : "md:justify-end"
      } [&>a]:w-full [&>button]:w-full md:[&>a]:w-auto md:[&>button]:w-auto`}
    >
      {children}
    </div>
  );
}

// A form field in a dialog or a settings card: an uppercase label, the control,
// and an optional hint line under it.
export function Field({
  label,
  htmlFor,
  hint,
  hintId,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  hintId?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="text-fg-muted mb-2 block font-ui text-[14px] font-bold tracking-[0.06em] uppercase"
      >
        {label}
      </label>
      {children}
      {hint && (
        <p
          id={hintId}
          className="text-fg-muted mt-2 font-ui text-[15px] leading-relaxed"
        >
          {hint}
        </p>
      )}
    </div>
  );
}

// The one text-field look: a 48px rounded field with a 3:1 border.
export const FIELD_CLASS =
  "border-edge bg-surface text-fg placeholder:text-fg-faint focus:border-primary h-12 w-full rounded-field border-[1.5px] px-4 font-ui text-[17px] outline-none";
