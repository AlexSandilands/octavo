import type { BlockPatch } from "@/lib/blocks";
import type { Column } from "@/lib/page-bands";
import { TbBtn } from "./rich-text-editor";

// Full / Left / Right for a text block (aboard #23): consecutive Left and Right
// blocks share a two-column band, a Full block spans the page.
const COLUMNS = [
  { value: undefined, icon: "columnFull", title: "Full width" },
  { value: "left", icon: "columnLeft", title: "Left column" },
  { value: "right", icon: "columnRight", title: "Right column" },
] as const;

export function TextColumnControl({
  column,
  onChange,
}: {
  column?: Column;
  onChange: (patch: BlockPatch) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Column"
      className="border-hair flex overflow-hidden rounded-[6px] border"
    >
      {COLUMNS.map((c) => (
        <TbBtn
          key={c.icon}
          icon={c.icon}
          title={c.title}
          active={column === c.value}
          onClick={() => onChange({ column: c.value })}
        />
      ))}
    </div>
  );
}
