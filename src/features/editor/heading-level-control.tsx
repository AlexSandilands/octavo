import {
  HEADING_LEVELS,
  type BlockPatch,
  type HeadingLevel,
} from "@/lib/blocks";
import { SegmentGroup, Segment } from "./segment";

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
    <div className="border-hairline-strong bg-sheet flex items-center gap-2 rounded-ui border px-2.5 py-1.5 whitespace-nowrap">
      <SegmentGroup label="Heading">
        {HEADING_LEVELS.map((l) => (
          <Segment
            key={l.value}
            active={level === l.value}
            onClick={() => onChange({ level: l.value })}
          >
            {l.label}
          </Segment>
        ))}
      </SegmentGroup>
    </div>
  );
}
