import { HEADING_LEVELS, type HeadingLevel } from "@/lib/blocks";

// Rank picker for a selected heading block, shown in its floating toolbar (see
// editor-block.tsx) — mirrors TextSizeControl. Switches a heading between the
// big page/feature title, an article section head, and a small run-in sub-head.
export function HeadingLevelControl({
  level,
  onChange,
}: {
  level: HeadingLevel;
  onChange: (patch: Record<string, string | number>) => void;
}) {
  return (
    <div className="border-hair flex items-center gap-2 rounded-[8px] border bg-white px-2.5 py-1.5 whitespace-nowrap shadow-[0_4px_14px_rgba(40,36,28,0.16)]">
      <span className="text-faint2 font-sans text-[9px] font-semibold tracking-[0.14em] uppercase">
        Heading
      </span>
      <div className="border-hair flex overflow-hidden rounded-[6px] border">
        {HEADING_LEVELS.map((l) => (
          <button
            key={l.value}
            type="button"
            aria-pressed={level === l.value}
            onClick={(e) => {
              e.stopPropagation();
              onChange({ level: l.value });
            }}
            className={`flex h-7 items-center justify-center px-2.5 font-sans text-[12px] font-semibold ${
              level === l.value
                ? "bg-accent text-paper"
                : "text-muted hover:bg-[#f4f8f5] hover:text-accent bg-white"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}
