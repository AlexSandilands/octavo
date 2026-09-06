import {
  HEADING_LEVELS,
  type BlockPatch,
  type HeadingLevel,
} from "@/lib/blocks";

// Rank picker for a selected heading block, shown in its floating toolbar (see
// editor-block.tsx). Switches a heading between the big page/feature title, an
// article section head, and a small run-in sub-head.
export function HeadingLevelControl({
  level,
  onChange,
}: {
  level: HeadingLevel;
  onChange: (patch: BlockPatch) => void;
}) {
  return (
    <div className="border-hairline flex items-center gap-2 rounded-[8px] border bg-white px-2.5 py-1.5 whitespace-nowrap">
      <span className="text-grey-soft font-ui text-[9px] font-semibold tracking-[0.14em] uppercase">
        Heading
      </span>
      <div className="border-hairline flex overflow-hidden rounded-[6px] border">
        {HEADING_LEVELS.map((l) => (
          <button
            key={l.value}
            type="button"
            aria-pressed={level === l.value}
            onClick={(e) => {
              e.stopPropagation();
              onChange({ level: l.value });
            }}
            className={`flex h-7 items-center justify-center px-2.5 font-ui text-[12px] font-semibold ${
              level === l.value
                ? "bg-red text-sheet"
                : "text-grey hover:bg-newsprint hover:text-red bg-white"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}
