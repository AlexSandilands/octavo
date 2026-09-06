import { Icon, type IconName } from "@/components/icons";
import {
  PAGE_ALIGNS,
  type BlockPatch,
  type ImageAlign,
  type PageAlign,
} from "@/lib/blocks";

// Placement + size controls for a selected image block. Lives in the block's
// floating toolbar (see editor-block.tsx). Writes back through the same onChange
// the text fields use, so changes ride the normal autosave.

const PLACEMENTS: { value: ImageAlign; icon: IconName; title: string }[] = [
  { value: "left", icon: "wrapLeft", title: "Image left, text wraps right" },
  { value: "full", icon: "breakText", title: "Break text (full width)" },
  { value: "right", icon: "wrapRight", title: "Image right, text wraps left" },
];

// The two page-owning placements (#227), offered alongside the three above.
const PAGE_PLACEMENTS: { value: PageAlign; icon: IconName; title: string }[] = [
  {
    value: "page-fill",
    icon: "fillPage",
    title: "Fill page (edge to edge, trims the photo)",
  },
  {
    value: "page-fit",
    icon: "fitPage",
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
            <Icon name={p.icon} size={16} />
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
              <Icon name={p.icon} size={16} />
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
              <span className="px-0.5 font-sans text-[12px] font-semibold">
                {s.label}
              </span>
            </Seg>
          ))}
        </Group>
      )}
    </div>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-faint2 font-sans text-[9px] font-semibold tracking-[0.14em] uppercase">
        {label}
      </span>
      <div className="border-hair flex overflow-hidden rounded-[6px] border">
        {children}
      </div>
    </div>
  );
}

function Seg({
  active,
  title,
  onClick,
  children,
}: {
  active: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex h-7 min-w-7 items-center justify-center px-1.5 ${
        active
          ? "bg-accent text-paper"
          : "text-muted hover:bg-accent-wash hover:text-accent bg-white"
      }`}
    >
      {children}
    </button>
  );
}
