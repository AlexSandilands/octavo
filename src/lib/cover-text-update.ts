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
  if (element.type === "teaser")
    return {
      ...element,
      placement,
      ...(field === "title" ? { title: text } : { description: text }),
    };
  if (element.type === "details") return { ...element, placement, text };
  if (element.type === "contents") {
    if (field === "title") return { ...element, placement, title: text };
    return {
      ...element,
      placement,
      items: element.items.map((item) => {
        if (field === `${item.headingId}:title`)
          return { ...item, title: text };
        if (field === `${item.headingId}:description`)
          return { ...item, description: text };
        return item;
      }),
    };
  }
  return element;
}
