import { Icon, type IconName } from "@/components/icons";
import { FieldLabel } from "./cover-fields";

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  icon?: IconName;
};

/** A labelled, full-width segmented control: one pill, the current option filled. */
export function Segments<T extends string>({
  label,
  value,
  options,
  onChange,
  compact = false,
}: {
  label: string;
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  /** No label above; for a bar where the group speaks for itself. */
  compact?: boolean;
}) {
  return (
    <fieldset>
      {compact ? (
        <legend className="sr-only">{label}</legend>
      ) : (
        <FieldLabel as="legend">{label}</FieldLabel>
      )}
      <div
        className={`border-hair-warm flex rounded-lg border bg-white ${compact ? "p-0.5" : "p-0.5"}`}
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-label={`${label}: ${o.value}`}
            aria-pressed={o.value === value}
            title={o.label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange(o.value)}
            className={`flex min-w-0 flex-1 cursor-pointer items-center justify-center rounded-md px-1 font-sans text-xs font-medium transition-colors ${compact ? "h-7" : "h-8"} ${
              o.value === value
                ? "bg-accent text-paper"
                : "text-muted hover:bg-accent-wash hover:text-accent"
            }`}
          >
            {o.icon ? <Icon name={o.icon} size={16} /> : o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
