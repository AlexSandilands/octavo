import type { CoverOverlay, Page } from "@/lib/blocks";
import { pageFillsCanvas } from "@/features/blocks/layout";

export function CoverDecorationControls({
  page,
  value,
  hasMasthead,
  onChange,
}: {
  page: Page;
  value: CoverOverlay;
  hasMasthead?: boolean;
  onChange: (value: CoverOverlay) => void;
}) {
  const decorated = value.decoration ?? !pageFillsCanvas(page);
  return (
    <div className="space-y-3">
      <Toggle
        label="Show theme decoration"
        checked={decorated}
        onChange={(decoration) => onChange({ ...value, decoration })}
      />
      {decorated && hasMasthead && (
        <Toggle
          label="Show magazine name and issue number"
          checked={value.masthead ?? true}
          onChange={(masthead) => onChange({ ...value, masthead })}
        />
      )}
      <p className="text-muted font-sans text-xs leading-relaxed">
        {decorated && hasMasthead
          ? "Hide the small text at the top while keeping the page frame."
          : "The page frame and ornaments. Your fonts stay the same."}
      </p>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="boxed-field border-hair-warm flex cursor-pointer items-center gap-3 rounded-lg border bg-white p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-accent h-5 w-5 shrink-0"
      />
      <span className="text-ink font-sans text-sm">{label}</span>
    </label>
  );
}
