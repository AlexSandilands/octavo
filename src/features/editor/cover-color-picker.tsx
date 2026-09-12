import { useEffect, useRef } from "react";
import { Icon } from "@/components/icons";
import {
  COVER_PALETTE,
  colorCss,
  isLightColor,
  type CoverColor,
} from "@/lib/cover-appearance";
import { FieldLabel } from "./cover-fields";

export function resolvedColor(css: string): string {
  const el = document.createElement("span");
  el.style.color = css;
  document.body.append(el);
  const rgb = getComputedStyle(el)
    .color.match(/[\d.]+/g)
    ?.slice(0, 3)
    .map(Number);
  el.remove();
  return rgb?.length === 3
    ? `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`
    : "#20201c";
}
/** The text colour a freshly chosen panel colour calls for. */
export function readableText(background: CoverColor): CoverColor {
  return isLightColor(background) ? "ink" : "paper";
}

/** A labelled swatch row for the inspector. */
export function CoverColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: CoverColor;
  onChange: (color: CoverColor) => void;
}) {
  return (
    <fieldset>
      <FieldLabel as="legend">{label}</FieldLabel>
      <ColorSwatches label={label} value={value} onChange={onChange} />
    </fieldset>
  );
}

// The palette plus one custom slot. The native colour input is a 1px anchor at
// the row's left edge, opened from the custom swatch, so the browser's picker
// pops out over the row (to the right) rather than off the edge of the screen.
export function ColorSwatches({
  label,
  value,
  onChange,
  size = 28,
}: {
  /** Prefix for each swatch's accessible name ("Panel colour: Paper"). */
  label: string;
  value: CoverColor;
  onChange: (color: CoverColor) => void;
  size?: number;
}) {
  const custom = useRef<HTMLInputElement>(null);
  const isCustom = value.startsWith("#");
  useEffect(() => {
    if (custom.current) custom.current.value = resolvedColor(colorCss(value));
  }, [value]);
  const swatch = (active: boolean) =>
    `relative flex shrink-0 cursor-pointer items-center justify-center rounded-full border transition-[box-shadow,transform] motion-safe:active:scale-95 ${
      active
        ? "border-transparent ring-accent ring-2 ring-offset-2 ring-offset-card"
        : "border-hair-warm hover:ring-hair hover:ring-2 hover:ring-offset-2 hover:ring-offset-card"
    }`;
  return (
    <div className="relative flex flex-wrap items-center gap-2">
      <input
        ref={custom}
        type="color"
        tabIndex={-1}
        aria-label={`${label}: custom colour`}
        defaultValue="#20201c"
        className="pointer-events-none absolute bottom-0 left-0 h-px w-px opacity-0"
        onChange={(e) => onChange(e.target.value)}
      />
      {COVER_PALETTE.map((p) => (
        <button
          key={p.value}
          type="button"
          aria-label={`${label}: ${p.label}`}
          title={p.label}
          aria-pressed={value === p.value}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChange(p.value)}
          className={swatch(value === p.value)}
          style={{ width: size, height: size, backgroundColor: p.css }}
        />
      ))}
      <button
        type="button"
        aria-label={`${label}: choose a custom colour`}
        title={isCustom ? `Custom colour ${value}` : "Custom colour"}
        aria-pressed={isCustom}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          const input = custom.current;
          if (!input) return;
          if ("showPicker" in input) input.showPicker();
          else (input as HTMLInputElement).click();
        }}
        className={`${swatch(isCustom)} ${isCustom ? "" : "border-dashed bg-white text-muted"}`}
        style={{
          width: size,
          height: size,
          backgroundColor: isCustom ? value : undefined,
        }}
      >
        {!isCustom && <Icon name="plus" size={13} strokeWidth={2} />}
      </button>
    </div>
  );
}
