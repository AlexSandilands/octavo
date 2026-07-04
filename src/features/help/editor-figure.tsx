import { FigureBadge, FigureFrame } from "./guide-ui";

// A schematic of the issue editor built from the site's own tokens, so it
// stays native-looking if the brand skin changes. Decorative (FigureFrame
// hides it from screen readers); the numbered legend in section-issues.tsx
// carries the meaning.

const INSERT_CHIPS = ["Heading", "Text", "Image", "Sponsor"];

export function EditorFigure() {
  return (
    <FigureFrame caption="A sketch of the editor. The numbers match the steps below: 1 — title and autosave, 2 — the pages rail, 3 — the Insert row, 4 — Preview and Publish.">
      <div className="border-line bg-paper overflow-hidden rounded-lg border">
        {/* Top bar: title, draft chip, autosave note / Preview + Publish. */}
        <div className="border-line flex items-center justify-between gap-2 border-b px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <FigureBadge n={1} />
            <span className="text-ink truncate font-serif text-[13px]">
              Spring Notes
            </span>
            <span className="bg-chip text-faint hidden rounded-full px-2 py-0.5 font-sans text-[9px] font-semibold whitespace-nowrap sm:inline">
              Draft · No. 4
            </span>
            <span className="text-faint2 font-sans text-[9px]">Saved</span>
          </div>
          <div className="flex flex-none items-center gap-1.5">
            <FigureBadge n={4} />
            <span className="border-hair text-ink rounded-md border bg-white px-2.5 py-1 font-sans text-[10px] font-semibold">
              Preview
            </span>
            <span className="bg-accent text-paper rounded-md px-2.5 py-1 font-sans text-[10px] font-semibold">
              Publish
            </span>
          </div>
        </div>
        {/* Insert toolbar. */}
        <div className="border-line flex items-center gap-1.5 border-b px-3 py-1.5">
          <FigureBadge n={3} />
          <span className="text-faint font-sans text-[8px] font-semibold tracking-[0.18em] uppercase">
            Insert
          </span>
          {INSERT_CHIPS.map((b) => (
            <span
              key={b}
              className="border-hair-warm text-ink rounded-[5px] border bg-white px-2 py-0.5 font-sans text-[9.5px] font-semibold"
            >
              {b}
            </span>
          ))}
        </div>
        <div className="flex">
          {/* Pages rail: thumbnails + the add tile. */}
          <div className="border-line flex w-[62px] flex-none flex-col items-center gap-2 border-r px-2 py-2.5">
            <FigureBadge n={2} />
            <span className="border-accent bg-page block h-[26px] w-9 rounded-[3px] border-[1.5px]" />
            <span className="border-hair-warm bg-page block h-[26px] w-9 rounded-[3px] border" />
            <span className="border-dash text-faint2 flex h-[26px] w-9 items-center justify-center rounded-[3px] border border-dashed font-sans text-[11px]">
              +
            </span>
          </div>
          {/* Canvas with one mock page. */}
          <div className="bg-canvas flex flex-1 items-center justify-center py-4">
            <div className="bg-page w-[124px] rounded-[2px] p-2.5 shadow-[0_2px_8px_rgba(20,32,28,0.18)]">
              <div className="bg-rule h-1.5 w-3/4 rounded-xs" />
              <div className="bg-line h-1 w-full rounded-xs mt-2" />
              <div className="bg-line h-1 w-11/12 rounded-xs mt-1" />
              <div className="photo-fill mt-2 h-[34px] w-full rounded-[2px]" />
              <div className="bg-line h-1 w-full rounded-xs mt-2" />
              <div className="bg-line h-1 w-2/3 rounded-xs mt-1" />
            </div>
          </div>
        </div>
      </div>
    </FigureFrame>
  );
}
