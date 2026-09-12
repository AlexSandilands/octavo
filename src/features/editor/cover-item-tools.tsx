import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";

/** Same on-page move/delete affordances as ordinary magazine blocks. */
export function CoverItemTools({
  selected,
  bleed = false,
  onMove,
  onRemove,
  handle,
}: {
  selected: boolean;
  bleed?: boolean;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
  handle?: ReactNode;
}) {
  return (
    <>
      {handle}
      {selected && (
        <div
          className={`absolute z-20 flex flex-col gap-1 ${bleed ? "right-2 bottom-2.5" : "top-1/2 -right-9 -translate-y-1/2"}`}
        >
          {!bleed && (
            <>
              <Control
                icon="arrowUp"
                label="Move up"
                onClick={() => onMove(-1)}
              />
              <Control
                icon="arrowDown"
                label="Move down"
                onClick={() => onMove(1)}
              />
            </>
          )}
          <Control icon="trash" label="Delete" onClick={onRemove} />
        </div>
      )}
    </>
  );
}
function Control({
  icon,
  label,
  onClick,
}: {
  icon: IconName;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`border-hair-warm flex h-6 w-6 cursor-pointer items-center justify-center rounded-[5px] border bg-white ${icon === "trash" ? "text-warn hover:border-warn" : "text-muted hover:border-accent hover:text-accent"}`}
    >
      <Icon name={icon} size={13} strokeWidth={1.9} />
    </button>
  );
}
