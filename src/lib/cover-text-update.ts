import type { CoverElement } from "./cover-elements";
import type { CoverRichDoc } from "./cover-rich-text";
/** Plain fields remain the reference/search source of truth; formatting accompanies them. */
export function updateCoverText(
  element: CoverElement,
  field: string,
  text: string,
  doc: CoverRichDoc,
): CoverElement {
  const placement = {
    ...element.placement,
    richText: { ...element.placement.richText, [field]: doc },
  };
  if (element.type === "details") return { ...element, placement, text };
  if (element.type === "stories") {
    if (field === "title") return { ...element, placement, title: text };
    return {
      ...element,
      placement,
      items: element.items.map((item) => {
        if (field === `${item.id}:title`) return { ...item, title: text };
        if (field === `${item.id}:description`)
          return { ...item, description: text };
        return item;
      }),
    };
  }
  return element;
}

/** As above, from an on-page editor showing `shown` (which for a linked title is
 *  the source heading): formatting alone leaves the stored text untouched, so a
 *  linked title stays linked. */
export function updateShownCoverText(
  element: CoverElement,
  field: string,
  shown: string,
  text: string,
  doc: CoverRichDoc,
): CoverElement {
  const next = updateCoverText(element, field, text, doc);
  return text === shown ? { ...element, placement: next.placement } : next;
}
