import type { CoverWarning } from "./use-cover-layout-warnings";

// Each warning names its item(s); pointing at one lights them up on the page,
// and pressing it selects the first so the fix is one click away.
export function CoverWarnings({
  warnings,
  onHint,
  onSelect,
}: {
  warnings: CoverWarning[];
  onHint: (ids: string[]) => void;
  onSelect: (id: string) => void;
}) {
  if (!warnings.length) return null;
  return (
    <ul role="status" aria-label="Layout checks" className="-mx-2 space-y-0.5">
      {warnings.map((w, i) => (
        <li key={`${w.ids.join("+")}:${i}`}>
          <button
            type="button"
            onMouseEnter={() => onHint(w.ids)}
            onMouseLeave={() => onHint([])}
            onFocus={() => onHint(w.ids)}
            onBlur={() => onHint([])}
            onClick={() => {
              if (w.ids[0]) onSelect(w.ids[0]);
            }}
            title="Show me"
            className="text-warn hover:bg-warn-soft flex w-full cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 text-left font-sans text-xs leading-relaxed transition-colors"
          >
            <span
              aria-hidden
              className="bg-warn mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full"
            />
            {w.text}
          </button>
        </li>
      ))}
    </ul>
  );
}
