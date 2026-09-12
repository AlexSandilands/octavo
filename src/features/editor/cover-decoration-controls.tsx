import { SelectCheckbox } from "@/components/select-checkbox";
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
    <div className="-ml-3 space-y-0.5">
      <SelectCheckbox
        label="Show theme decoration"
        checked={decorated}
        onChange={(decoration) => onChange({ ...value, decoration })}
      >
        Show theme decoration
      </SelectCheckbox>
      {decorated && hasMasthead && (
        <SelectCheckbox
          label="Show magazine name and issue number"
          checked={value.masthead ?? true}
          onChange={(masthead) => onChange({ ...value, masthead })}
        >
          Show magazine name and issue number
        </SelectCheckbox>
      )}
    </div>
  );
}
