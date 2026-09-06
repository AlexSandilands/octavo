"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/icons";

// The one checkbox an admin list's row selection is built from. A real
// `<input type="checkbox">` inside a `<label>`, so keyboard operation (Space),
// the announced checked/mixed state and the "click the words" affordance all
// come for free; the visible box is drawn on top and the input is stretched
// invisibly across a 44px cell, because the audience is older and phone-heavy
// and a 24px mark is not a tap target. `indeterminate` is a DOM property with
// no attribute, so it is set through a ref.
export function SelectCheckbox({
  checked,
  indeterminate = false,
  onChange,
  label,
  children,
}: {
  checked: boolean;
  /** Shows the mixed state — some, but not all, of the group is selected. */
  indeterminate?: boolean;
  onChange: (next: boolean) => void;
  /** The accessible name; `children` is the optional visible text beside it. */
  label: string;
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const mixed = indeterminate && !checked;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = mixed;
  }, [mixed]);

  const box =
    checked || mixed
      ? "border-primary bg-primary text-surface"
      : "border-edge bg-surface";

  return (
    <label className="flex cursor-pointer items-center select-none">
      <span className="relative flex h-11 w-11 flex-none items-center justify-center">
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          aria-label={label}
          onChange={(e) => onChange(e.target.checked)}
          className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <span
          aria-hidden
          className={`flex h-6 w-6 items-center justify-center rounded-[7px] border-2 transition-colors peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--color-primary)] ${box}`}
        >
          {checked && <Icon name="check" size={15} strokeWidth={3} />}
          {mixed && <Icon name="minus" size={15} strokeWidth={3} />}
        </span>
      </span>
      {children && (
        <span className="text-fg-muted pr-2 font-ui text-[16px]">
          {children}
        </span>
      )}
    </label>
  );
}
