"use client";

import { Icon } from "@/components/icons";
import { SURFACES, type SurfaceKind } from "./surfaces";

// The panel with no surface open (#353): the same list the + menu offers, as
// a quiet choice in the middle of the panel — a heading and one plain row per
// surface — so a first-time author sees the options without finding the +.
// The panel puts the focus on the first row when it opens on it.
export function SurfaceChoice({
  unavailable,
  onOpen,
}: {
  unavailable?: Partial<Record<SurfaceKind, string>>;
  onOpen: (kind: SurfaceKind) => void;
}) {
  return (
    <div
      data-surface-choice
      className="flex flex-1 flex-col items-center justify-center px-6 py-8"
    >
      <div className="flex w-full max-w-[260px] flex-col gap-2">
        <h2 className="text-ink px-3 pb-1 text-center font-sans text-[15px] font-semibold">
          Open a surface
        </h2>
        {SURFACES.map((surface) => {
          const reason = unavailable?.[surface.kind];
          const descriptionId = `surface-choice-${surface.kind}-reason`;
          return (
            <div key={surface.kind} className="flex flex-col">
              <button
                type="button"
                aria-disabled={reason ? true : undefined}
                aria-describedby={reason ? descriptionId : undefined}
                onClick={reason ? undefined : () => onOpen(surface.kind)}
                className={`text-ink border-hair flex h-11 w-full items-center gap-3 rounded-lg border bg-white px-3 font-sans text-[14px] font-medium shadow-[0_1px_2px_rgba(40,36,28,0.05)] transition-colors duration-150 select-none ${
                  reason
                    ? "cursor-default opacity-50"
                    : "hover:border-accent hover:bg-accent-wash cursor-pointer"
                }`}
              >
                <Icon name={surface.icon} size={16} className="text-accent" />
                {surface.label}
              </button>
              {reason && (
                <p
                  id={descriptionId}
                  className="text-faint px-3 pb-1 font-sans text-[12px] leading-snug"
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
