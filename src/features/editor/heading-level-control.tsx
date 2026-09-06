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
    <div className="border-hairline bg-surface shadow-float flex items-center gap-2 rounded-full border px-3 py-1.5 whitespace-nowrap">
      <span className="text-fg-muted font-ui text-[10px] font-bold tracking-[0.1em] uppercase">
        Heading
      </span>
      <div className="border-edge flex overflow-hidden rounded-full border">
        {HEADING_LEVELS.map((l) => (
          <button
            key={l.value}
            type="button"
            aria-pressed={level === l.value}
            onClick={(e) => {
              e.stopPropagation();
              onChange({ level: l.value });
            }}
            className={`flex h-8 cursor-pointer items-center justify-center px-3 font-ui text-[12px] font-bold transition-colors ${
              level === l.value
                ? "bg-primary text-surface"
                : "text-fg-muted hover:bg-primary-wash hover:text-primary bg-surface"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}
