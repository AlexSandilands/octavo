import { Icon } from "./icons";

// The grip on a draggable rail — the editor's panel gutter and the admin
// settings/preview split share it, so a handle reads the same everywhere: a
// white pill overhanging the rail, with grip dots, going accent under the
// pointer (via the rail's `group`), on focus and while dragging.
export function SplitGrip({ dragging }: { dragging: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`relative flex h-12 w-5 flex-none items-center justify-center rounded-full border-[1.5px] bg-white transition-colors duration-150 ${
        dragging
          ? "border-accent bg-accent-wash text-accent"
          : "border-hair-warm text-faint group-hover:border-accent group-hover:bg-accent-wash group-hover:text-accent group-focus-visible:border-accent group-focus-visible:text-accent"
      }`}
    >
      <Icon name="grip" size={18} />
    </span>
  );
}
