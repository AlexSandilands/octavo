import { Icon, type IconName } from "@/components/icons";
import { SegmentGroup as Group, Segment as Seg } from "./segment";
import {
  PAGE_ALIGNS,
  type BlockPatch,
  type ImageAlign,
  type PageAlign,
} from "@/lib/blocks";

// Placement + size controls for a selected image block. Lives in the block's
// floating toolbar (see editor-block.tsx). Writes back through the same onChange
// the text fields use, so changes ride the normal autosave.

// Each placement shows a short word beside its icon; the title carries the
// full description as the tooltip and the accessible name.
const PLACEMENTS: {
  value: ImageAlign;
  icon: IconName;
  word: string;
  title: string;
}[] = [
  {
    value: "left",
    icon: "wrapLeft",
    word: "Left",
    title: "Image left, text wraps right",
  },
  {
    value: "full",
    icon: "breakText",
    word: "Wide",
    title: "Break text (full width)",
  },
  {
    value: "right",
    icon: "wrapRight",
    word: "Right",
    title: "Image right, text wraps left",
  },
];

// The two page-owning placements (#227), offered alongside the three above.
const PAGE_PLACEMENTS: {
  value: PageAlign;
  icon: IconName;
  word: string;
  title: string;
}[] = [
  {
    value: "page-fill",
    icon: "fillPage",
    word: "Fill page",
    title: "Fill page (edge to edge, trims the photo)",
  },
  {
    value: "page-fit",
    icon: "fitPage",
    word: "Fit page",
    title: "Fit page (the whole photo, with bars)",
  },
];

const SIZES: { value: number; label: string }[] = [
  { value: 33, label: "S" },
  { value: 50, label: "M" },
  { value: 66, label: "L" },
  { value: 100, label: "Full" },
];

export function ImageLayoutControls({
  align,
  width,
  onChange,
  onFillPage,
}: {
  align: ImageAlign;
  width: number;
  onChange: (patch: BlockPatch) => void;
  /** Offered on image blocks only (issue #227), and not on a cover page. Its own
   *  handler rather than a patch: taking the page may have to move the photo
   *  onto a page of its own first, which is one edit, not a field write. */
  onFillPage?: (align: PageAlign) => void;
}) {
  // Only page-owning where the control is offered. A cover page renders a stored
  // page-owning image as an ordinary centred photo, so it reads — and is edited
  // — as the "full" it actually is, size control and all.
  const owned = PAGE_ALIGNS.some((a) => a === align);
  const filled = owned && onFillPage !== undefined;
  const shown = owned && !filled ? "full" : align;
  return (
    <div className="flex items-center gap-2.5">
      <Group label="Placement">
        {PLACEMENTS.map((p) => (
          <Seg
            key={p.value}
            active={shown === p.value}
            title={p.title}
            onClick={() => onChange({ align: p.value })}
          >
            <Icon name={p.icon} size={15} />
            {p.word}
          </Seg>
        ))}
        {onFillPage &&
          PAGE_PLACEMENTS.map((p) => (
            <Seg
              key={p.value}
              active={filled && align === p.value}
              title={p.title}
              onClick={() => onFillPage(p.value)}
            >
              <Icon name={p.icon} size={15} />
              {p.word}
            </Seg>
          ))}
      </Group>
      {/* A page-owning photo has no text column to be a percentage of; the
          stored width is left alone so unsetting the placement restores it. */}
      {!filled && (
        <Group label="Size">
          {SIZES.map((s) => (
            <Seg
              key={s.value}
              active={width === s.value}
              title={`${s.value}%`}
              onClick={() => onChange({ width: s.value })}
            >
              {s.label}
            </Seg>
          ))}
        </Group>
      )}
    </div>
  );
}
