"use client";

import { Icon } from "@/components/icons";
import { SURFACES, type SurfaceKind } from "./surfaces";

// The panel with no surface open (#353): the same list the + menu offers, as
// a plain choice, so a first-time author sees the options without finding the
// +. The panel puts the focus on its first button when it opens on it.
export function SurfaceChoice({
  unavailable,
  onOpen,
}: {
  unavailable?: Partial<Record<SurfaceKind, string>>;
  onOpen: (kind: SurfaceKind) => void;
}) {
  return (
    <div data-surface-choice className="flex flex-1 flex-col gap-4 px-6 py-8">
      <h2 className="text-ink font-serif text-[21px]">Open a surface</h2>
      <p className="text-muted font-sans text-[14px] leading-snug">
        Work beside the page: choose what to open here. Open surfaces stay as
        tabs along the top of the panel.
      </p>
      <div className="flex flex-col gap-3">
        {SURFACES.map((surface) => {
          const reason = unavailable?.[surface.kind];
          const descriptionId = `surface-choice-${surface.kind}-reason`;
          return (
            <div key={surface.kind} className="flex flex-col gap-1.5">
              <button
                type="button"
                aria-disabled={reason ? true : undefined}
                aria-describedby={reason ? descriptionId : undefined}
                onClick={reason ? undefined : () => onOpen(surface.kind)}
                className={`border-hair-warm text-ink flex h-12 w-full items-center gap-3 rounded-lg border-[1.5px] bg-white px-4 font-sans text-[15px] font-semibold transition-[transform,background-color,border-color] duration-150 ease-out select-none ${
                  reason
                    ? "cursor-default opacity-50"
                    : "hover:border-accent hover:bg-accent-wash cursor-pointer motion-safe:active:scale-[0.97]"
                }`}
              >
                <Icon name={surface.icon} size={18} className="text-accent" />
                {surface.label}
              </button>
              {reason && (
                <p
                  id={descriptionId}
                  className="text-faint px-1 font-sans text-[13px] leading-snug"
                >
                  {reason}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
