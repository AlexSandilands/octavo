import type { CoverShadow, CoverColor } from "@/lib/cover-appearance";
import { CoverColorPicker } from "./cover-color-picker";
import { Segments } from "./cover-segments";

export const SHADOW_OPTIONS = [
  { value: "none", label: "None" },
  { value: "soft", label: "Soft" },
  { value: "strong", label: "Strong" },
] as const satisfies { value: CoverShadow; label: string }[];

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
    <div className="space-y-4">
      <Segments
        label={label}
        value={value}
        options={[...SHADOW_OPTIONS]}
        onChange={(s) => onChange(s, color)}
      />
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
