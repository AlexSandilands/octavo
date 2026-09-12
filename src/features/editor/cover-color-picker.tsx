import { useEffect, useRef } from "react";
import {
  COVER_PALETTE,
  colorCss,
  type CoverColor,
} from "@/lib/cover-appearance";

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
export function readableText(background: CoverColor): CoverColor {
  const hex = resolvedColor(colorCss(background));
  const rgb = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]! > 0.35
    ? "ink"
    : "paper";
}
export function CoverColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: CoverColor;
  onChange: (color: CoverColor) => void;
}) {
  const custom = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (custom.current) custom.current.value = resolvedColor(colorCss(value));
  }, [value]);
  return (
    <fieldset className="space-y-2">
      <legend className="text-muted mb-2 font-sans text-xs font-medium">
        {label}
      </legend>
      <div className="flex flex-wrap items-center gap-2">
        {COVER_PALETTE.map((p) => (
          <button
            key={p.value}
            type="button"
            aria-label={`${label}: ${p.label}`}
            title={p.label}
            aria-pressed={value === p.value}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange(p.value)}
            className={`border-hair-warm h-7 w-7 cursor-pointer rounded-full border transition-shadow hover:ring-2 hover:ring-hair ${value === p.value ? "ring-accent ring-2 ring-offset-2 ring-offset-card" : ""}`}
            style={{ backgroundColor: p.css }}
          />
        ))}
        <label
          title="Custom colour"
          className={`border-hair-warm relative h-7 w-7 cursor-pointer overflow-hidden rounded-full border bg-white ${value.startsWith("#") ? "ring-accent ring-2 ring-offset-2" : ""}`}
        >
          <input
            type="color"
            aria-label={`${label}: custom colour`}
            ref={custom}
            defaultValue="#20201c"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            onChange={(e) => {
              onChange(e.target.value);
            }}
          />
          <span
            aria-hidden
            className="text-ink pointer-events-none absolute inset-0 flex items-center justify-center font-sans text-lg"
          >
            +
          </span>
        </label>
      </div>
    </fieldset>
  );
}
