import {
  FigureBadge,
  FigureFrame,
  MiniButton,
  MiniSelect,
  MiniStatus,
} from "./guide-ui";

// A schematic of the issue editor built from the site's own tokens, so it
// stays native-looking if the brand skin changes. Decorative (FigureFrame
// hides it from screen readers); the numbered legend in section-issues.tsx
// carries the meaning.

const INSERT_CHIPS = ["Heading", "Text", "Image", "Sponsor"];

export function EditorFigure() {
  return (
    <FigureFrame caption="A sketch of the editor. The numbers match the steps below: 1 — title and autosave, 2 — the pages rail, 3 — the Insert row, 4 — Preview and Publish.">
      <div className="scrollbar-soft overflow-x-auto">
        <div className="border-lead bg-sheet min-w-[460px] overflow-hidden border">
          {/* Top bar: back, title, draft box, autosave note / Look, Preview,
              Publish. */}
          <div className="border-lead flex items-center justify-between gap-2 border-b-[3px] px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="text-lead font-ui text-[11px] font-semibold underline">
                ← Issues
              </span>
              <FigureBadge n={1} />
              <span className="text-lead truncate font-display text-[16px] font-semibold">
                Spring Notes
              </span>
              <MiniStatus>Draft</MiniStatus>
              <span className="text-grey-soft font-ui text-[10.5px]">Saved</span>
            </div>
            <div className="flex flex-none items-center gap-2">
              <MiniSelect>Look: Classic</MiniSelect>
              <FigureBadge n={4} />
              <MiniButton>Preview</MiniButton>
              <MiniButton primary>Publish</MiniButton>
            </div>
          </div>
          {/* Insert row. */}
          <div className="border-hairline flex items-center gap-2 border-b px-4 py-2">
            <FigureBadge n={3} />
            <span className="text-grey-soft font-ui text-[9px] font-semibold tracking-[0.14em] uppercase">
              Insert
            </span>
            {INSERT_CHIPS.map((b) => (
              <MiniButton key={b}>{b}</MiniButton>
            ))}
            <span className="ml-auto flex gap-2">
              <MiniButton>Undo</MiniButton>
              <MiniButton>Redo</MiniButton>
            </span>
          </div>
          <div className="flex">
            {/* Pages rail: numbered thumbnails + the add control. */}
            <div className="border-hairline flex w-[84px] flex-none flex-col items-center gap-2.5 border-r px-2 py-3">
              <FigureBadge n={2} />
              <span className="border-lead bg-sheet relative block h-9 w-12 border-2">
                <span className="text-lead absolute top-0.5 left-1 font-ui text-[8px] font-bold">
                  1
                </span>
              </span>
              <span className="border-hairline-strong bg-sheet relative block h-9 w-12 border">
                <span className="text-lead absolute top-0.5 left-1 font-ui text-[8px] font-bold">
                  2
                </span>
              </span>
              <span className="border-lead text-lead flex h-7 w-12 items-center justify-center border border-dashed font-ui text-[9px] font-semibold">
                + Add
              </span>
            </div>
            {/* Canvas with one mock page. */}
            <div className="bg-newsprint flex flex-1 items-center justify-center py-6">
              <div className="bg-sheet border-hairline-strong w-[170px] border p-3.5">
                <div className="bg-hairline h-2 w-3/4" />
                <div className="bg-hairline mt-2.5 h-[5px] w-full" />
                <div className="bg-hairline mt-1.5 h-[5px] w-11/12" />
                <div className="photo-fill mt-2.5 h-[46px] w-full" />
                <div className="bg-hairline mt-2.5 h-[5px] w-full" />
                <div className="bg-hairline mt-1.5 h-[5px] w-2/3" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </FigureFrame>
  );
}
