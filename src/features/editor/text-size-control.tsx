import { TEXT_SIZES, type TextSize } from "@/lib/blocks";

// Size picker for a selected text block, shown in its floating toolbar (see
// editor-block.tsx). Writes back through the same onChange the text fields use,
// so the choice rides the normal autosave. The page is a fixed canvas, so this
// is the author's lever for fitting copy to a page.
export function TextSizeControl({
  size,
  onChange,
}: {
  size: TextSize;
  onChange: (patch: Record<string, string | number>) => void;
}) {
  return (
    <div className="border-hair flex items-center gap-2 rounded-[8px] border bg-white px-2.5 py-1.5 whitespace-nowrap shadow-[0_4px_14px_rgba(40,36,28,0.16)]">
      <span className="text-faint2 font-sans text-[9px] font-semibold tracking-[0.14em] uppercase">
        Text size
      </span>
      <div className="border-hair flex overflow-hidden rounded-[6px] border">
        {TEXT_SIZES.map((s) => (
          <button
            key={s.value}
            type="button"
            title={s.value.toUpperCase()}
            aria-pressed={size === s.value}
            onClick={(e) => {
              e.stopPropagation();
              onChange({ size: s.value });
            }}
            className={`flex h-7 min-w-7 items-center justify-center px-2 font-sans text-[12px] font-semibold ${
              size === s.value
                ? "bg-accent text-paper"
                : "text-muted hover:bg-[#f4f8f5] hover:text-accent bg-white"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
