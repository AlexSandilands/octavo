"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/icons";

// The one checkbox for the members table's row selection. A real
// `<input type="checkbox">` inside a `<label>`, so keyboard operation (Space),
// the announced checked/mixed state and the "click the words" affordance all
// come for free; the visible box is drawn on top and the input is stretched
// invisibly across a 44px cell, because the audience is older and phone-heavy
// and a 22px mark is not a tap target. `indeterminate` is a DOM property with
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

  // Both states name their own background: Tailwind resolves a `bg-white`
  // / `bg-accent` collision by stylesheet order, not by which one the template
  // appends last, so a shared `bg-white` base would win and the filled box
  // would render empty.
  const box =
    checked || mixed
      ? "border-accent bg-accent text-paper"
      : "border-hair-warm bg-white";

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
          className={`flex h-[22px] w-[22px] items-center justify-center rounded-[5px] border-[1.5px] transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--color-accent)] ${box}`}
        >
          {checked && <Icon name="check" size={14} strokeWidth={2.6} />}
          {mixed && <Icon name="minus" size={14} strokeWidth={2.6} />}
        </span>
      </span>
      {children && (
        <span className="text-muted pr-2 font-sans text-[14px]">
          {children}
        </span>
      )}
    </label>
  );
}
