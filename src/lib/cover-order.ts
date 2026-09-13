import {
  DEFAULT_COVER_OVERLAY,
  isPageOwning,
  type Block,
  type CoverOverlay,
  type Page,
} from "./blocks";
import {
  resolveCoverAppearance,
  type CoverAppearance,
} from "./cover-appearance";
import {
  COVER_ELEMENT_LABELS,
  DEFAULT_COVER_PLACEMENT,
  type CoverElement,
  type CoverPlacement,
} from "./cover-elements";

export type CoverItem = Block | CoverElement;
export function placementOf(item: CoverItem, page: Page): CoverPlacement {
  return "placement" in item
    ? item.placement
    : ("coverPlacement" in item && item.coverPlacement) || {
        ...DEFAULT_COVER_PLACEMENT,
        row: page.coverOverlay?.position ?? "center",
      };
}
/** Whether a cover is laid out on the anchor grid (v7) rather than as a stack. */
export function hasCoverLayout(page: Page) {
  return Boolean(
    page.cover &&
    (page.coverElements?.length ||
      (page.coverOverlay && !page.blocks.some(isPageOwning)) ||
      page.blocks.some((b) => "coverPlacement" in b && b.coverPlacement)),
  );
}
/** The cover's default contrast: shadowed light type over a photo, dark type on paper. */
export function coverOverlayOf(page: Page): CoverOverlay {
  const photo = page.blocks.some(isPageOwning);
  return (
    page.coverOverlay ??
    (photo
      ? DEFAULT_COVER_OVERLAY
      : { ...DEFAULT_COVER_OVERLAY, style: "dark" })
  );
}
/** What one item paints with: its own overrides over the cover's defaults. A
 *  photo carries no type, so it takes no panel unless one is asked for; photos
 *  and logos have no lines for a panel to fit, so theirs is always a block. */
export function itemAppearance(
  item: CoverItem,
  page: Page,
): Required<CoverAppearance> {
  const overlay = coverOverlayOf(page),
    placement = placementOf(item, page);
  const paint = resolveCoverAppearance(
    placement.style ?? overlay.style,
    placement.style
      ? placement.appearance
      : { ...overlay.appearance, ...placement.appearance },
  );
  if (item.type === "image" || item.type === "logo") paint.panelShape = "block";
  return item.type === "image" && placement.appearance?.panel === undefined
    ? { ...paint, panel: false }
    : paint;
}
export function coverItemLabel(item: CoverItem): string {
  if ("placement" in item) return COVER_ELEMENT_LABELS[item.type];
  return item.type === "heading"
    ? "Heading"
    : item.type === "text"
      ? "Text"
      : item.type === "image"
        ? "Image"
        : item.type[0]!.toUpperCase() + item.type.slice(1);
}
export function coverItems(page: Page): CoverItem[] {
  return [
    ...page.blocks.filter((b) => !isPageOwning(b)),
    ...(page.coverElements ?? []),
  ].sort(
    (a, b) =>
      (placementOf(a, page).order ?? 0) - (placementOf(b, page).order ?? 0),
  );
}
/** Dropping onto an item joins its anchor; one ordering spans every cover item. */
export function reorderCover(
  page: Page,
  activeId: string,
  overId: string,
): Page {
  const items = coverItems(page),
    from = items.findIndex((i) => i.id === activeId),
    to = items.findIndex((i) => i.id === overId);
  if (from < 0 || to < 0 || from === to) return page;
  const active = items[from]!,
    target = placementOf(items[to]!, page);
  items.splice(from, 1);
  items.splice(to, 0, active);
  const placements = new Map(
    items.map((item, order) => [
      item.id,
      {
        ...placementOf(item, page),
        order,
        ...(item.id === activeId
          ? { row: target.row, column: target.column }
          : {}),
      },
    ]),
  );
  return {
    ...page,
    blocks: page.blocks.map((b) =>
      b.type === "heading" ||
      b.type === "text" ||
      (b.type === "image" && placements.has(b.id))
        ? { ...b, coverPlacement: placements.get(b.id) }
        : b,
    ),
    coverElements: page.coverElements?.map((e) => ({
      ...e,
      placement: placements.get(e.id) ?? e.placement,
    })),
  };
}
