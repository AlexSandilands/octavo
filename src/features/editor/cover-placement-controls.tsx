import type { CoverPlacement } from "@/lib/cover-elements";
import { FieldLabel } from "./cover-fields";
import { Segments } from "./cover-segments";

const ROWS = ["top", "center", "bottom"] as const;
const COLUMNS = ["left", "center", "right"] as const;
const ROW_NAMES = { top: "Top", center: "Centre", bottom: "Bottom" } as const;
const COLUMN_NAMES = {
  left: "left",
  center: "centre",
  right: "right",
} as const;

/** Where a cover item sits. Text items also choose width, alignment and type size. */
export function CoverPlacementControls({
  value,
  onChange,
  variant = "text",
}: {
  value: CoverPlacement;
  onChange: (value: CoverPlacement) => void;
  /** Logos and images size themselves, so they only take a position and a nudge. */
  variant?: "text" | "logo" | "image";
}) {
  const text = variant === "text";
  const nudge = (
    <label className="text-muted block font-sans text-xs font-medium">
      <span className="flex items-baseline justify-between">
        Vertical adjustment
        <span className="text-faint font-mono text-[11px]">
          {value.offset > 0 ? "+" : ""}
          {value.offset}
        </span>
      </span>
      <input
        aria-label="Vertical adjustment"
        type="range"
        min={-60}
        max={60}
        step={2}
        value={value.offset}
        onChange={(e) => onChange({ ...value, offset: Number(e.target.value) })}
        className="accent-accent mt-1 h-6 w-full cursor-pointer"
      />
    </label>
  );
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <fieldset className="shrink-0">
          <FieldLabel as="legend">Position</FieldLabel>
          <div
            className="border-hair-warm grid grid-cols-3 gap-1 rounded-lg border bg-white p-1"
            aria-label="Cover position"
          >
            {ROWS.flatMap((row) =>
              COLUMNS.map((column) => {
                const active = value.row === row && value.column === column;
                return (
                  <button
                    key={`${row}-${column}`}
                    type="button"
                    aria-label={`${ROW_NAMES[row]} ${COLUMN_NAMES[column]}`}
                    title={`${ROW_NAMES[row]} ${COLUMN_NAMES[column]}`}
                    aria-pressed={active}
                    onClick={() => onChange({ ...value, row, column })}
                    className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition-colors ${
                      active
                        ? "bg-accent text-paper"
                        : "text-faint2 hover:bg-accent-wash hover:text-accent"
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-sm bg-current" />
                  </button>
                );
              }),
            )}
          </div>
        </fieldset>
        <div className="min-w-0 flex-1 space-y-4">
          {text ? (
            <>
              <Segments
                label="Width"
                value={value.width}
                options={[
                  { value: "narrow", label: "S" },
                  { value: "medium", label: "M" },
                  { value: "wide", label: "L" },
                ]}
                onChange={(width) => onChange({ ...value, width })}
              />
              <Segments
                label="Alignment"
                value={value.align}
                options={[
                  { value: "left", label: "Left", icon: "alignLeft" },
                  { value: "center", label: "Centre", icon: "alignCenter" },
                  { value: "right", label: "Right", icon: "alignRight" },
                ]}
                onChange={(align) => onChange({ ...value, align })}
              />
            </>
          ) : (
            nudge
          )}
        </div>
      </div>
      {text && (
        <>
          <Segments
            label="Text size"
            value={value.textSize ?? "normal"}
            options={[
              { value: "small", label: "S" },
              { value: "normal", label: "M" },
              { value: "large", label: "L" },
              { value: "xlarge", label: "XL" },
            ]}
            onChange={(textSize) => onChange({ ...value, textSize })}
          />
          {nudge}
        </>
      )}
    </div>
  );
}
