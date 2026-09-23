"use client";

import { Icon } from "@/components/icons";

// "3 replies ▾" under a comment (issue #301): replies start folded so a long
// thread reads as its top-level comments; this opens and closes them.
export function RepliesToggle({
  count,
  open,
  controls,
  onToggle,
}: {
  count: number;
  open: boolean;
  /** The id of the replies list it shows and hides. */
  controls: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={open ? controls : undefined}
      onClick={onToggle}
      className="text-accent hover:bg-accent-wash -ml-2 inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg px-2 font-sans text-[14px] font-semibold transition-colors"
    >
      {count} {count === 1 ? "reply" : "replies"}
      <Icon
        name="chevronDown"
        size={16}
        strokeWidth={2}
        className={`transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
      />
    </button>
  );
}
