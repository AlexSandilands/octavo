import { FigureBadge, FigureFrame } from "./guide-ui";

// A schematic of the issue editor built from the site's own tokens, so it
// stays native-looking if the brand skin changes. Decorative (FigureFrame
// hides it from screen readers); the numbered legend in section-issues.tsx
// carries the meaning.

const INSERT_CHIPS = ["Heading", "Text", "Image", "Sponsor"];

export function EditorFigure() {
  return (
    <FigureFrame caption="A sketch of the editor. The numbers match the steps below: 1 — title and autosave, 2 — the pages rail, 3 — the Insert row, 4 — Preview and Publish.">
      <div className="scrollbar-soft overflow-x-auto [--scrollbar-surface:var(--color-sheet)]">
        <div className="border-hairline bg-sheet min-w-[440px] overflow-hidden rounded-ui border">
          {/* Top bar: title, draft chip, autosave note / Preview + Publish. */}
          <div className="border-hairline flex items-center justify-between gap-2 border-b px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <FigureBadge n={1} />
              <span className="text-lead truncate font-display text-[16px]">
                Spring Notes
              </span>
              <span className="bg-newsprint text-grey-soft hidden rounded-full px-2.5 py-0.5 font-ui text-[10.5px] font-semibold whitespace-nowrap sm:inline">
                Draft · No. 4
              </span>
              <span className="text-grey-soft font-ui text-[10.5px]">Saved</span>
            </div>
            <div className="flex flex-none items-center gap-2">
              <FigureBadge n={4} />
              <span className="border-hairline text-lead rounded-ui border bg-white px-3 py-1.5 font-ui text-[12px] font-semibold">
                Preview
              </span>
              <span className="bg-red text-sheet rounded-ui px-3 py-1.5 font-ui text-[12px] font-semibold">
                Publish
              </span>
            </div>
          </div>
          {/* Insert toolbar. */}
          <div className="border-hairline flex items-center gap-2 border-b px-4 py-2">
            <FigureBadge n={3} />
            <span className="text-grey-soft font-ui text-[9px] font-semibold tracking-[0.18em] uppercase">
              Insert
            </span>
            {INSERT_CHIPS.map((b) => (
              <span
                key={b}
                className="border-hairline text-lead rounded-[6px] border bg-white px-2.5 py-1 font-ui text-[11.5px] font-semibold"
              >
                {b}
              </span>
            ))}
          </div>
          <div className="flex">
            {/* Pages rail: thumbnails + the add tile. */}
            <div className="border-hairline flex w-[78px] flex-none flex-col items-center gap-2.5 border-r px-2 py-3">
              <FigureBadge n={2} />
              <span className="border-red bg-sheet block h-8 w-11 rounded-[3px] border-[1.5px]" />
              <span className="border-hairline bg-sheet block h-8 w-11 rounded-[3px] border" />
              <span className="border-hairline-strong text-grey-soft flex h-8 w-11 items-center justify-center rounded-[3px] border border-dashed font-ui text-[13px]">
                +
              </span>
            </div>
            {/* Canvas with one mock page. */}
            <div className="bg-newsprint flex flex-1 items-center justify-center py-6">
              <div className="bg-sheet w-[170px] rounded-[2px] p-3.5">
                <div className="bg-hairline h-2 w-3/4 rounded-xs" />
                <div className="bg-hairline mt-2.5 h-[5px] w-full rounded-xs" />
                <div className="bg-hairline mt-1.5 h-[5px] w-11/12 rounded-xs" />
                <div className="photo-fill mt-2.5 h-[46px] w-full rounded-[2px]" />
                <div className="bg-hairline mt-2.5 h-[5px] w-full rounded-xs" />
                <div className="bg-hairline mt-1.5 h-[5px] w-2/3 rounded-xs" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </FigureFrame>
  );
}
