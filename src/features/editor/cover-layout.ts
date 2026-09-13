import type { Page, PageAlign } from "@/lib/blocks";
import { isFillPage } from "@/features/blocks/layout";

/** Keep one background, without removing or moving any existing cover content. */
export function setCoverBackground(
  page: Page,
  id: string,
  align: PageAlign,
): Page {
  return {
    ...page,
    blocks: page.blocks.map((b) =>
      b.type !== "image"
        ? b
        : b.id === id
          ? { ...b, align }
          : isFillPage(b)
            ? { ...b, align: "full" }
            : b,
    ),
  };
}

/** A cover with overlays returns to ordinary flow when demoted to an interior page. */
export function withCoverStyle(page: Page, cover: boolean): Page {
  return {
    ...page,
    cover,
    blocks:
      !cover && (page.blocks.length > 1 || Boolean(page.coverElements?.length))
        ? page.blocks.map((b) =>
            b.type === "image" && isFillPage(b) ? { ...b, align: "full" } : b,
          )
        : page.blocks,
  };
}
