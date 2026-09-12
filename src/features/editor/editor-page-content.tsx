import type { Ref } from "react";
import type { Page, BlockPatch, PageAlign } from "@/lib/blocks";
import { type CoverElement, type CoverSource } from "@/lib/cover-elements";
import type { ImageMap, ResolvedImage } from "@/lib/images";
import type { SponsorListItem, SponsorMap } from "@/lib/sponsors";
import type { LayoutTheme } from "@/features/blocks/themes/registry";
import { PageContent } from "@/features/blocks/page-content";
import { itemAppearance } from "@/lib/cover-order";
import { caretColorFor } from "@/lib/cover-appearance";
import { pageFillsCanvas } from "@/features/blocks/layout";
import { EditorCoverElement } from "./editor-cover-element";
import { EditorBlock } from "./editor-block";
import type { BlockOverflow } from "./page-metrics";

export function EditorPageContent({
  page,
  containerRef,
  sources,
  issueNo,
  issueId,
  theme,
  images,
  sponsors,
  sponsorMap,
  reseed,
  sel,
  hint,
  overflow,
  onSelect,
  onSelectElement,
  updateBlock,
  updateElement,
  moveBlock,
  removeBlock,
  removeElement,
  moveElement,
  flow,
  fillPage,
  registerImage,
}: {
  page: Page;
  containerRef: Ref<HTMLDivElement>;
  sources: CoverSource[];
  issueNo: number;
  issueId: string;
  theme: LayoutTheme;
  images: ImageMap;
  sponsors: SponsorListItem[];
  sponsorMap: SponsorMap;
  reseed: Record<string, number>;
  sel: string | null;
  /** Items a layout warning is pointing at. */
  hint: string[];
  overflow: BlockOverflow | null;
  onSelect: (id: string) => void;
  onSelectElement: (id: string) => void;
  updateElement: (element: CoverElement) => void;
  updateBlock: (id: string, patch: BlockPatch) => void;
  moveBlock: (id: string, dir: -1 | 1) => void;
  removeBlock: (id: string) => void;
  removeElement: (id: string) => void;
  moveElement: (id: string, dir: -1 | 1) => void;
  flow: (id: string) => void;
  fillPage: (id: string, align: PageAlign) => void;
  registerImage: (id: string, image: ResolvedImage) => void;
}) {
  const photo = pageFillsCanvas(page);
  return (
    <PageContent
      page={page}
      containerRef={containerRef}
      empty={
        <div className="text-faint2 py-16 text-center font-serif text-sm">
          This page is empty. Add a block below.
        </div>
      }
      renderElement={(element) => (
        <EditorCoverElement
          element={element}
          onUpdate={updateElement}
          sources={sources}
          issueNo={issueNo}
          images={images}
          selected={sel === element.id}
          hinted={hint.includes(element.id)}
          appearance={itemAppearance(element, page)}
          caret={caretColorFor(itemAppearance(element, page), photo)}
          onSelect={() => onSelectElement(element.id)}
          onMove={(dir) => moveElement(element.id, dir)}
          onRemove={() => removeElement(element.id)}
          overflow={overflow?.id === element.id}
        />
      )}
      renderBlock={(b) => (
        <EditorBlock
          key={`${b.id}:${reseed[b.id] ?? 0}`}
          block={b}
          theme={theme}
          cover={page.cover}
          selected={b.id === sel}
          hinted={hint.includes(b.id)}
          appearance={page.cover ? itemAppearance(b, page) : undefined}
          caret={
            page.cover
              ? caretColorFor(itemAppearance(b, page), photo)
              : undefined
          }
          issueId={issueId}
          images={images}
          sponsors={sponsors}
          sponsorMap={sponsorMap}
          overflowAt={overflow?.id === b.id ? overflow.markerTop : undefined}
          fitsAlone={overflow?.fitsAlone}
          onSelect={() => onSelect(b.id)}
          onChange={(patch) => updateBlock(b.id, patch)}
          onMove={(dir) => moveBlock(b.id, dir)}
          onRemove={() => removeBlock(b.id)}
          onFlow={() => flow(b.id)}
          onFillPage={(a) => fillPage(b.id, a)}
          onRegisterImage={registerImage}
        />
      )}
    />
  );
}
