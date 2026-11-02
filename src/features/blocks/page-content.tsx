import { appearanceVars, resolveCoverAppearance } from "@/lib/cover-appearance";
import type { ReactNode, Ref } from "react";
import type { Block, Page } from "@/lib/blocks";
import { coverOverlayOf, hasCoverLayout } from "@/lib/cover-order";
import { pageSegments, type Column } from "@/lib/page-bands";
import { BAND_STYLE, isFillPage } from "./layout";
import { type CoverElement } from "@/lib/cover-elements";
import { coverEntries } from "./cover-entries";
import { CoverGrid } from "./cover-grid";
import { PAGE_H, PAGE_PAD } from "./page-frame";

// Shared composition for the editor, reader, thumbnails and print pages.
export function PageContent({
  page,
  renderBlock,
  containerRef,
  empty,
  renderElement,
  trailing,
}: {
  page: Page;
  /** `column` is set for a block in a two-column band (aboard #23). */
  renderBlock: (block: Block, column?: Column) => ReactNode;
  containerRef?: Ref<HTMLDivElement>;
  empty?: ReactNode;
  renderElement?: (element: CoverElement) => ReactNode;
  /** Rendered after the blocks of an ordinary page (the editor's drop preview). */
  trailing?: ReactNode;
}) {
  const background = page.cover ? page.blocks.find(isFillPage) : undefined;
  const elements = page.coverElements ?? [];
  if (hasCoverLayout(page)) {
    const overlay = coverOverlayOf(page);
    const entries = coverEntries(page, renderBlock, renderElement);
    return (
      <div
        ref={containerRef}
        className="cover-composition relative"
        data-cover-style={overlay.style}
      >
        {background && renderBlock(background)}
        <CoverGrid entries={entries} />
      </div>
    );
  }
  if (!background) {
    return (
      <div
        ref={containerRef}
        className={
          page.cover
            ? "flex min-h-full flex-col justify-center"
            : "relative flow-root"
        }
      >
        {page.blocks.length
          ? page.cover
            ? page.blocks.map((b) => renderBlock(b))
            : flowBlocks(page.blocks, renderBlock)
          : elements.length || trailing
            ? null
            : empty}
        {trailing}
        {elements.map((e) => (
          <div key={e.id} className="mb-6">
            {renderElement?.(e)}
          </div>
        ))}
      </div>
    );
  }
  const overlay = coverOverlayOf(page);
  const paint = resolveCoverAppearance(overlay.style, overlay.appearance);
  const foreground = page.blocks.filter((b) => b.id !== background.id);
  return (
    <div
      ref={containerRef}
      className="cover-composition relative"
      data-cover-style={overlay.style}
      data-cover-position={overlay.position}
      data-cover-panel={paint.panel}
      data-cover-panel-shape={paint.panelShape}
      style={appearanceVars(paint)}
    >
      {renderBlock(background)}
      <div
        className="cover-overlay-layout pointer-events-none relative flex flex-col"
        style={{ minHeight: PAGE_H - 2 * PAGE_PAD }}
      >
        {foreground.length > 0 && (
          <div className="cover-overlay-content pointer-events-auto">
            {foreground.map((b) => renderBlock(b))}
          </div>
        )}
      </div>
    </div>
  );
}

/** An interior page's blocks: full-width blocks in flow, each band as two
 *  stacked columns side by side. */
export function flowBlocks(
  blocks: Block[],
  renderBlock: (block: Block, column?: Column) => ReactNode,
) {
  return pageSegments(blocks).map((s) =>
    s.kind === "block" ? (
      renderBlock(s.block)
    ) : (
      <div key={`band:${s.id}`} data-band style={BAND_STYLE}>
        {(["left", "right"] as const).map((column) => (
          <div key={column} data-band-column={column} className="flow-root">
            {s[column].map((b) => renderBlock(b, column))}
          </div>
        ))}
      </div>
    ),
  );
}
