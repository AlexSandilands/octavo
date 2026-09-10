import { richTextToPlain } from "@/lib/rich-text-doc";
import { blockKind } from "../block-kinds";
import type { ImportKind, Region, ReviewItem } from "./model";

/** The detector's suggestion, before the author picks a kind. */
export function suggestedKind(region: Region): ImportKind {
  return region.kind === "image"
    ? "image"
    : region.heading
      ? "heading"
      : "text";
}

export function itemKind(item: ReviewItem): ImportKind {
  return item.block.type === "heading"
    ? "heading"
    : item.block.type === "image"
      ? "image"
      : "text";
}

/** A short preview of the region, for list rows and accessible names. */
export function regionPreview(region: Region, max = 70): string {
  if (region.kind === "image")
    return `Photo ${region.image?.width ?? "?"} × ${region.image?.height ?? "?"}`;
  const text = richTextToPlain(region.doc).replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function regionLabel(
  region: Region,
  kind: ImportKind,
  selected: boolean,
  added: "imported" | "partial" | null,
): string {
  const state = selected
    ? ", selected"
    : added === "imported"
      ? ", added"
      : added === "partial"
        ? ", partly added"
        : "";
  return `${blockKind(kind).label}${state}: ${regionPreview(region)}`;
}
