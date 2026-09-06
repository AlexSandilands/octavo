import { FigureBadge, FigureFrame } from "./guide-ui";

// A schematic of the issue editor built from the site's own tokens, so it
// stays native-looking if the brand skin changes. Decorative (FigureFrame
// hides it from screen readers); the numbered legend in section-issues.tsx
// carries the meaning.

const INSERT_CHIPS = ["Heading", "Text", "Image", "Sponsor"];

export function EditorFigure() {
  return (
    <FigureFrame caption="A sketch of the editor. The numbers match the steps below: 1 — title and autosave, 2 — the pages rail, 3 — the Insert row, 4 — Preview and Publish.">
      <div className="scrollbar-soft overflow-x-auto [--scrollbar-surface:var(--color-card)]">
        <div className="border-hairline bg-ground min-w-[440px] overflow-hidden rounded-ui border">
          {/* Top bar: title, draft chip, autosave note / Preview + Publish. */}
          <div className="border-hairline bg-raised flex items-center justify-between gap-2 border-b px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <FigureBadge n={1} />
              <span className="text-chrome-text truncate font-display text-[16px]">
                Spring Notes
              </span>
              <span className="bg-lifted text-chrome-muted hidden rounded-full px-2.5 py-0.5 font-meta text-[10px] font-medium tracking-[0.08em] whitespace-nowrap uppercase sm:inline">
                Draft · No. 4
              </span>
              <span className="text-chrome-muted font-ui text-[10.5px]">Saved</span>
            </div>
            <div className="flex flex-none items-center gap-2">
              <FigureBadge n={4} />
              <span className="border-chrome-muted text-chrome-text rounded-md border px-3 py-1.5 font-ui text-[12px] font-semibold">
                Preview
              </span>
              <span className="bg-brass text-ground rounded-md px-3 py-1.5 font-ui text-[12px] font-semibold">
                Publish
              </span>
            </div>
          </div>
          {/* Insert toolbar. */}
          <div className="border-hairline bg-raised flex items-center gap-2 border-b px-4 py-2">
            <FigureBadge n={3} />
            <span className="text-chrome-muted font-meta text-[9px] font-medium tracking-[0.18em] uppercase">
              Insert
            </span>
            {INSERT_CHIPS.map((b) => (
              <span
                key={b}
                className="border-hairline bg-lifted text-chrome-text rounded-[6px] border px-2.5 py-1 font-ui text-[11.5px] font-semibold"
              >
                {b}
              </span>
            ))}
          </div>
          <div className="flex">
            {/* Pages rail: thumbnails + the add tile. */}
            <div className="border-hairline bg-raised flex w-[78px] flex-none flex-col items-center gap-2.5 border-r px-2 py-3">
              <FigureBadge n={2} />
              <span className="border-brass bg-page block h-8 w-11 rounded-[3px] border-[1.5px]" />
              <span className="border-hair-warm bg-page block h-8 w-11 rounded-[3px] border" />
              <span className="border-chrome-muted text-chrome-muted flex h-8 w-11 items-center justify-center rounded-[3px] border border-dashed font-ui text-[13px]">
                +
              </span>
            </div>
            {/* Canvas with one mock page. */}
            <div className="bg-ground flex flex-1 items-center justify-center py-6">
              <div className="bg-page shadow-glow-sm w-[170px] rounded-[2px] p-3.5">
                <div className="bg-rule h-2 w-3/4 rounded-xs" />
                <div className="bg-line mt-2.5 h-[5px] w-full rounded-xs" />
                <div className="bg-line mt-1.5 h-[5px] w-11/12 rounded-xs" />
                <div className="photo-fill mt-2.5 h-[46px] w-full rounded-[2px]" />
                <div className="bg-line mt-2.5 h-[5px] w-full rounded-xs" />
                <div className="bg-line mt-1.5 h-[5px] w-2/3 rounded-xs" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </FigureFrame>
  );
}
