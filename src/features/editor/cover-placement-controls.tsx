import { Icon, type IconName } from "@/components/icons";
import type { CoverPlacement } from "@/lib/cover-elements";

const ROWS = ["top", "center", "bottom"] as const;
const COLUMNS = ["left", "center", "right"] as const;
export function CoverPlacementControls({
  value,
  onChange,
  logo = false,
}: {
  value: CoverPlacement;
  onChange: (value: CoverPlacement) => void;
  logo?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-4">
        <fieldset className="shrink-0">
          <legend className="text-muted mb-2 font-sans text-xs font-medium">
            Position
          </legend>
          <div
            className="border-hair-warm grid grid-cols-3 gap-1 rounded-lg border bg-white p-1"
            aria-label="Cover position"
          >
            {ROWS.flatMap((row) =>
              COLUMNS.map((column) => (
                <button
                  key={`${row}-${column}`}
                  type="button"
                  aria-label={`${row === "center" ? "Centre" : row === "top" ? "Top" : "Bottom"} ${column === "center" ? "centre" : column}`}
                  title={`${row} ${column}`}
                  aria-pressed={value.row === row && value.column === column}
                  onClick={() => onChange({ ...value, row, column })}
                  className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded transition-colors ${value.row === row && value.column === column ? "bg-accent text-paper" : "text-faint2 hover:bg-accent-wash"}`}
                >
                  <span className="h-1.5 w-1.5 rounded-sm bg-current" />
                </button>
              )),
            )}
          </div>
        </fieldset>
        {!logo && (
          <div className="min-w-0 flex-1 space-y-3">
            <Segments
              label="Width"
              value={value.width}
              options={[
                ["narrow", "S"],
                ["medium", "M"],
                ["wide", "L"],
              ]}
              onChange={(width) => onChange({ ...value, width })}
            />
            <Segments
              label="Alignment"
              value={value.align}
              options={[
                ["left", "Left"],
                ["center", "Centre"],
                ["right", "Right"],
              ]}
              onChange={(align) => onChange({ ...value, align })}
            />
          </div>
        )}
        {logo && (
          <p className="text-muted pt-6 font-sans text-xs leading-relaxed">
            The frame follows the logo’s size. Choose a position to anchor it to
            the page.
          </p>
        )}
      </div>
      {!logo && (
        <Segments
          label="Text size"
          value={value.textSize ?? "normal"}
          options={[
            ["small", "S"],
            ["normal", "M"],
            ["large", "L"],
            ["xlarge", "XL"],
          ]}
          onChange={(textSize) => onChange({ ...value, textSize })}
        />
      )}
      <label className="text-muted block font-sans text-xs font-medium">
        Vertical adjustment{" "}
        <span className="float-right font-mono">
          {value.offset > 0 ? "+" : ""}
          {value.offset}
        </span>
        <input
          aria-label="Vertical adjustment"
          type="range"
          min={-60}
          max={60}
          step={2}
          value={value.offset}
          onChange={(e) =>
            onChange({ ...value, offset: Number(e.target.value) })
          }
          className="accent-accent mt-1 h-6 w-full cursor-pointer"
        />
      </label>
    </div>
  );
}
function Segments<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-muted mb-2 font-sans text-xs font-medium">
        {label}
      </legend>
      <div className="border-hair-warm flex rounded-lg border bg-white p-0.5">
        {options.map(([key, text]) => (
          <button
            key={key}
            type="button"
            aria-label={`${label}: ${key}`}
            aria-pressed={key === value}
            title={`${label}: ${key}`}
            onClick={() => onChange(key)}
            className={`h-8 min-w-0 flex-1 cursor-pointer rounded-md px-1 font-sans text-xs transition-colors ${key === value ? "bg-accent text-paper" : "text-muted hover:bg-accent-wash"}`}
          >
            {label === "Alignment" ? (
              <Icon
                name={
                  (
                    {
                      left: "alignLeft",
                      center: "alignCenter",
                      right: "alignRight",
                    } as Record<string, IconName>
                  )[key]!
                }
                size={16}
                className="mx-auto"
              />
            ) : (
              text
            )}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
