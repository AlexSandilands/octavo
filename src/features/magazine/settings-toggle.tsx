"use client";

import type { ReactNode } from "react";

// The switches on the page (issues #162, #269). No house switch component
// exists, so this follows the publish modal's opt-in: a bordered card that *is*
// the label, so the whole box toggles rather than a 20px square — the p-4 box
// stands 50-odd pixels tall, comfortably past the 44px minimum, and reads as
// something you press. The ring lands on the box (.boxed-field) instead of
// floating a rectangle around the inner checkbox. `detail` is the optional
// paragraph below the box, for a switch whose consequences need spelling out.
export function SettingsToggle({
  id,
  label,
  hint,
  detail,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  detail?: ReactNode;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div>
      <label className="boxed-field border-hair flex cursor-pointer items-start gap-3 rounded-lg border-[1.5px] bg-white p-4">
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          aria-describedby={detail ? `${id}-hint ${id}-detail` : `${id}-hint`}
          className="accent-accent mt-0.5 h-5 w-5 flex-none"
        />
        <span className="font-sans text-[14px] leading-snug">
          <span className="text-ink font-semibold">{label}</span>
          <span id={`${id}-hint`} className="text-muted mt-0.5 block">
            {hint}
          </span>
        </span>
      </label>
      {detail && (
        <p
          id={`${id}-detail`}
          className="text-faint2 mt-1.5 font-sans text-[12px] leading-relaxed"
        >
          {detail}
        </p>
      )}
    </div>
  );
}
