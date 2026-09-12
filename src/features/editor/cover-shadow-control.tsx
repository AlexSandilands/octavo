import { Button } from "@/components/ui";
import type { CoverShadow, CoverColor } from "@/lib/cover-appearance";
import { CoverColorPicker } from "./cover-color-picker";
export function CoverShadowControl({
  label = "Text shadow",
  value,
  color,
  onChange,
}: {
  label?: string;
  value: CoverShadow;
  color: CoverColor;
  onChange: (value: CoverShadow, color: CoverColor) => void;
}) {
  return (
    <div className="space-y-3">
      <fieldset>
        <legend className="text-muted mb-2 font-sans text-xs font-medium">
          {label}
        </legend>
        <div className="flex gap-1">
          {(["none", "soft", "strong"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={value === s ? "primary" : "secondary"}
              className="min-w-0 flex-1 px-2!"
              aria-label={`${label}: ${s}`}
              aria-pressed={value === s}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onChange(s, color)}
            >
              {s[0]!.toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>
      </fieldset>
      {value !== "none" && (
        <CoverColorPicker
          label={`${label} colour`}
          value={color}
          onChange={(c) => onChange(value, c)}
        />
      )}
    </div>
  );
}
