import {
  CHIP_BAR,
  CHIP_GROUP,
  CHIP_LABEL,
  CHIP_SEG_OFF,
  CHIP_SEG_ON,
} from "./chip";
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
    <div className={CHIP_BAR}>
      <span className={CHIP_LABEL}>Heading</span>
      <div className={CHIP_GROUP}>
        {HEADING_LEVELS.map((l) => (
          <button
            key={l.value}
            type="button"
            aria-pressed={level === l.value}
            onClick={(e) => {
              e.stopPropagation();
              onChange({ level: l.value });
            }}
            className={`flex h-7 cursor-pointer items-center justify-center px-2.5 font-ui text-[12px] font-semibold transition-colors ${
              level === l.value ? CHIP_SEG_ON : CHIP_SEG_OFF
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}
