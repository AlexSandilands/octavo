"use client";

import { useId, useState } from "react";
import {
  SIZE_PRESETS,
  SIZE_PRESET_LABELS,
  clampSize,
  presetOf,
  type SizeAxis,
  type SizePreset,
} from "@/lib/branding";
import { MenuSelect, type MenuSelectItem } from "@/components/menu-select";

// One of the footer's two size controls on /admin/magazine (issue #216): a
// dropdown of the three presets plus Custom, which reveals a number field for
// an exact px size. The form holds a plain number; a value matching no preset
// opens as Custom. Out-of-range text reaches nothing (the preview keeps the
// last good value) and is held to the range on blur.

type Choice = SizePreset | "custom";

export function FooterSizeField({
  label,
  axis,
  value,
  onChange,
}: {
  /** The dropdown's own name, e.g. "Mark size". */
  label: string;
  axis: SizeAxis;
  value: number;
  onChange: (px: number) => void;
}) {
  const id = useId();
  const [custom, setCustom] = useState(() => presetOf(axis, value) === null);
  const [draft, setDraft] = useState(String(value));

  const choice: Choice = custom
    ? "custom"
    : (presetOf(axis, value) ?? "custom");
  const items: MenuSelectItem<Choice>[] = [
    ...SIZE_PRESETS.map((preset) => ({
      key: preset,
      value: preset as Choice,
      content: `${SIZE_PRESET_LABELS[preset]} (${axis.presets[preset]}px)`,
    })),
    { key: "custom", value: "custom", content: "Custom…" },
  ];

  const pick = (next: Choice) => {
    if (next === "custom") {
      setDraft(String(value));
      setCustom(true);
      return;
    }
    setCustom(false);
    onChange(axis.presets[next]);
  };

  const parsed = draft.trim() === "" ? NaN : Number(draft);
  const valid =
    Number.isInteger(parsed) && parsed >= axis.min && parsed <= axis.max;

  const edit = (text: string) => {
    setDraft(text);
    const n = text.trim() === "" ? NaN : Number(text);
    if (Number.isInteger(n) && n >= axis.min && n <= axis.max) onChange(n);
  };

  // On blur, hold an unusable draft to the range or restore the current value.
  const settle = () => {
    if (valid) return;
    const held = Number.isFinite(parsed) ? clampSize(axis, parsed) : value;
    setDraft(String(held));
    onChange(held);
  };

  const hintId = `${id}-hint`;
  const lower = label.toLowerCase();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-3">
        <MenuSelect
          label={label}
          current={custom ? "Custom" : SIZE_PRESET_LABELS[choice as SizePreset]}
          ariaLabel={`Footer ${lower}`}
          items={items}
          value={choice}
          onSelect={pick}
          size="md"
        />
        {custom && (
          <label
            htmlFor={id}
            className="text-ink flex items-center gap-2 font-sans text-sm font-medium"
          >
            Pixels
            <input
              id={id}
              type="number"
              inputMode="numeric"
              min={axis.min}
              max={axis.max}
              step={1}
              value={draft}
              onChange={(e) => edit(e.target.value)}
              onBlur={settle}
              aria-label={`${label} in pixels`}
              aria-describedby={hintId}
              aria-invalid={!valid}
              className={`text-ink h-11 w-24 rounded-lg border-[1.5px] bg-white px-3 font-sans text-[15px] tabular-nums outline-none ${
                valid ? "border-hair focus:border-accent" : "border-warn"
              }`}
            />
          </label>
        )}
      </div>
      {custom && (
        <p
          id={hintId}
          aria-live="polite"
          className={`font-sans text-[12px] leading-relaxed ${
            valid ? "text-faint2" : "text-warn"
          }`}
        >
          {valid
            ? `A whole number from ${axis.min} to ${axis.max}.`
            : `Use a whole number from ${axis.min} to ${axis.max}; anything else is held to the nearest allowed size.`}
        </p>
      )}
    </div>
  );
}
