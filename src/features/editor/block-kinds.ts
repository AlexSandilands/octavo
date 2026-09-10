import type { IconName } from "@/components/icons";
import type { BlockType } from "@/lib/blocks";

// One icon and label per block type, shared by the editor tool bar and the PDF
// import panel so a heading reads as the same mark wherever it is offered.
export const BLOCK_KINDS: { type: BlockType; label: string; icon: IconName }[] =
  [
    { type: "heading", label: "Heading", icon: "heading" },
    { type: "text", label: "Text", icon: "menu" },
    { type: "image", label: "Image", icon: "image" },
    { type: "montage", label: "Montage", icon: "grid" },
    { type: "video", label: "Video", icon: "play" },
    { type: "sponsor", label: "Sponsor", icon: "banner" },
  ];

export function blockKind(type: BlockType) {
  return BLOCK_KINDS.find((k) => k.type === type) ?? BLOCK_KINDS[1]!;
}
