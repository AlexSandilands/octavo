import { Icon, type IconName } from "@/components/icons";
import type { BlockPatch } from "@/lib/blocks";

// Placement + size controls for a selected image block. Lives in the block's
// floating toolbar (see editor-block.tsx). Writes back through the same onChange
// the text fields use, so changes ride the normal autosave.

type Align = "full" | "left" | "right";

const PLACEMENTS: { value: Align; icon: IconName; title: string }[] = [
  { value: "left", icon: "wrapLeft", title: "Image left, text wraps right" },
  { value: "full", icon: "breakText", title: "Break text (full width)" },
  { value: "right", icon: "wrapRight", title: "Image right, text wraps left" },
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
}: {
  align: Align;
  width: number;
  onChange: (patch: BlockPatch) => void;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Group label="Placement">
        {PLACEMENTS.map((p) => (
          <Seg
            key={p.value}
            active={align === p.value}
            title={p.title}
            onClick={() => onChange({ align: p.value })}
          >
            <Icon name={p.icon} size={16} />
          </Seg>
        ))}
      </Group>
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
          : "text-muted hover:bg-[#f4f8f5] hover:text-accent bg-white"
      }`}
    >
      {children}
    </button>
  );
}
