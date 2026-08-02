import type { TextFlowMetrics } from "./text-flow";

// Measuring the editor canvas (issue #93). The editor page is the one place the
// fixed PAGE_W×PAGE_H canvas is laid out truthfully, so overflow is *measured*
// there rather than estimated from character counts.
//
// Everything below reads `offsetTop`/`offsetHeight`, which are layout px on the
// unscaled canvas — the canvas zoom/pan (a CSS `scale` transform on an ancestor)
// never enters the arithmetic, so a zoomed-in author measures the same as a
// zoomed-out one. The two markers the measurement anchors on are set by
// `PageFrame`: `data-page-frame` on the page box, `data-page-footer` on the
// running footer.

/** Breathing room between the last line of text and the running footer. */
const FOOTER_GUTTER = 6;
/** Sub-pixel layout noise shouldn't read as an overflow. */
const SLACK = 1;

/** A block that runs past its page, and where the page's text area ends on it. */
export type BlockOverflow = {
  id: string;
  /** The page's bottom edge, in the block's own coordinates — where to draw it. */
  markerTop: number;
  /**
   * Whether the block would fit on a page of its own. False means relocating it
   * changes nothing — it is simply taller than a page — so no action is offered.
   */
  fitsAlone: boolean;
};

/**
 * Sum of `offsetTop` up the offsetParent chain. Returns null when `ancestor`
 * isn't on that chain, rather than a plausible-looking wrong number.
 */
function offsetWithin(el: HTMLElement, ancestor: HTMLElement): number | null {
  let top = 0;
  let node: HTMLElement | null = el;
  while (node && node !== ancestor) {
    top += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return node === ancestor ? top : null;
}

type PageGeometry = {
  page: HTMLElement;
  /** Bottom edge of the page's text area, above the running footer. */
  limit: number;
  /** Top edge of the text area — where a block on a fresh page starts. */
  contentTop: number;
};

/** Read the page box `container` sits in. Null before the canvas is laid out. */
function pageGeometry(container: HTMLElement): PageGeometry | null {
  const page = container.closest<HTMLElement>("[data-page-frame]");
  const footer = page?.querySelector<HTMLElement>("[data-page-footer]");
  if (!page || !footer) return null;
  return {
    page,
    limit: footer.offsetTop - FOOTER_GUTTER,
    contentTop: container.offsetTop,
  };
}

/**
 * The topmost block in `container` that runs past the page's text area, or null
 * when the page fits.
 *
 * Only one, deliberately: a page ends in exactly one place, so it gets exactly
 * one marker. Blocks further down are pushed off as a consequence of that first
 * one, and marking them too would stack several rules at the same height.
 */
export function measurePageOverflow(
  container: HTMLElement,
): BlockOverflow | null {
  const geo = pageGeometry(container);
  if (!geo) return null;
  let first: { id: string; top: number; height: number } | null = null;
  for (const el of container.querySelectorAll<HTMLElement>("[data-block-id]")) {
    const id = el.dataset.blockId;
    const top = offsetWithin(el, geo.page);
    if (!id || top === null) continue;
    const height = el.offsetHeight;
    if (top + height <= geo.limit + SLACK) continue;
    if (!first || top < first.top) first = { id, top, height };
  }
  if (!first) return null;
  return {
    id: first.id,
    markerTop: geo.limit - first.top,
    fitsAlone: first.height <= geo.limit - geo.contentTop + SLACK,
  };
}

/**
 * Measure one text block for the flow action: every top-level node's edges, plus
 * how much room the text has on this page and on a fresh one.
 *
 * Returns null when the rendered body doesn't line up with the document it was
 * built from — cutting on a mismatched index would move the wrong text, so the
 * caller offers no action instead.
 */
export function measureTextFlow(
  container: HTMLElement,
  blockId: string,
  nodeCount: number,
): TextFlowMetrics | null {
  const geo = pageGeometry(container);
  const block = container.querySelector<HTMLElement>(
    `[data-block-id="${CSS.escape(blockId)}"]`,
  );
  const body = block?.querySelector<HTMLElement>("[data-text-body]");
  if (!geo || !block || !body || nodeCount === 0) return null;

  const children = Array.from(body.children).filter(
    (c): c is HTMLElement => c instanceof HTMLElement,
  );
  if (children.length !== nodeCount) return null;

  const nodes: TextFlowMetrics["nodes"] = [];
  for (const child of children) {
    const top = offsetWithin(child, geo.page);
    if (top === null) return null;
    nodes.push({ top, bottom: top + child.offsetHeight });
  }

  const blockTop = offsetWithin(block, geo.page);
  if (blockTop === null) return null;
  // Whatever sits below this block on the page (its own gap, then any following
  // blocks) keeps its height when the text shrinks, so reserve it up front —
  // otherwise the flow would just push the block below off the page instead.
  const tailReserve = Math.max(
    0,
    geo.contentTop + container.offsetHeight - (blockTop + block.offsetHeight),
  );

  return {
    nodes,
    firstAvail: geo.limit - nodes[0]!.top - tailReserve,
    restAvail: geo.limit - geo.contentTop,
  };
}
