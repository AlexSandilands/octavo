"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/icons";
import { SurfaceMenu } from "./surface-menu";
import {
  SURFACES,
  type Surface,
  type SurfaceAction,
  type SurfaceKind,
} from "./surfaces";

export const tabId = (surfaceId: string) => `surface-tab-${surfaceId}`;

const SMALL =
  "border-hair-warm text-ink hover:border-accent hover:bg-accent-wash flex h-8 flex-none cursor-pointer items-center justify-center gap-1.5 rounded-[9px] border bg-white font-sans text-[13px] font-semibold transition-[transform,background-color,border-color] duration-150 ease-out select-none motion-safe:active:scale-95 disabled:cursor-default disabled:opacity-45 disabled:hover:border-hair-warm disabled:hover:bg-white";

// The strip along the top of the side panel (#353): a tab per open surface
// with its own small Close, then — for the active tab only — its actions
// (Replace PDF, New conversation) and the + that opens another surface; the
// header's Panel button is what closes the panel, so the strip carries no
// Close. Arrow keys move between tabs and switch to them, Home/End reach
// the ends, Delete closes the focused tab; closing a tab puts the focus on the
// tab that takes over, or on + when none is left. On a narrow panel the
// controls wrap under the tabs rather than lose their words.
export function SurfaceStrip({
  surfaces,
  activeId,
  tabpanelId,
  actions,
  onActivate,
  onCloseSurface,
  onOpenSurface,
}: {
  surfaces: Surface[];
  activeId: string | null;
  tabpanelId: string;
  actions: SurfaceAction[];
  onActivate: (id: string) => void;
  onCloseSurface: (id: string) => void;
  onOpenSurface: (kind: SurfaceKind) => void;
}) {
  const tabs = useRef<Record<string, HTMLButtonElement | null>>({});
  const plus = useRef<HTMLDivElement>(null);
  // A closed tab's focus lands on the tab that took over, else on +.
  const refocus = useRef(false);
  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    const next = activeId ? tabs.current[activeId] : null;
    (next ?? plus.current?.querySelector("button"))?.focus();
  });
  const close = (id: string) => {
    refocus.current = true;
    onCloseSurface(id);
  };
  const onTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    const n = surfaces.length;
    const go = (i: number) => {
      e.preventDefault();
      const target = surfaces[i]!;
      onActivate(target.id);
      tabs.current[target.id]?.focus();
    };
    if (e.key === "ArrowRight") go((index + 1) % n);
    else if (e.key === "ArrowLeft") go((index - 1 + n) % n);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(n - 1);
    else if (e.key === "Delete") {
      e.preventDefault();
      close(surfaces[index]!.id);
    }
  };

  return (
    <div
      data-surface-strip
      className="flex min-h-11 flex-none flex-wrap items-center gap-x-1 gap-y-1.5 px-2 pt-2 pb-1"
    >
      <div
        role="tablist"
        aria-label="Open surfaces"
        className="flex min-w-0 flex-wrap items-center gap-1"
      >
        {surfaces.map((surface, i) => {
          const active = surface.id === activeId;
          const meta = SURFACES.find((s) => s.kind === surface.kind)!;
          return (
            <div
              key={surface.id}
              role="presentation"
              className={`flex h-8 items-center rounded-[9px] border pr-0.5 pl-1 transition-[background-color,border-color] duration-150 ${
                active
                  ? "border-hair-warm text-ink bg-white"
                  : "text-muted hover:bg-accent-wash hover:text-ink border-transparent"
              }`}
            >
              <button
                ref={(el) => {
                  tabs.current[surface.id] = el;
                }}
                type="button"
                role="tab"
                id={tabId(surface.id)}
                aria-selected={active}
                aria-controls={active ? tabpanelId : undefined}
                tabIndex={active ? 0 : -1}
                onClick={() => onActivate(surface.id)}
                onKeyDown={(e) => onTabKeyDown(e, i)}
                className="flex h-7 min-w-0 cursor-pointer items-center gap-1.5 rounded-md px-1.5 font-sans text-[13px] font-semibold select-none"
              >
                <Icon
                  name={meta.icon}
                  size={15}
                  className={active ? "text-accent" : ""}
                />
                <span className="truncate">{meta.label}</span>
              </button>
              <button
                type="button"
                aria-label={`Close ${meta.label}`}
                title={`Close ${meta.label}`}
                onClick={() => close(surface.id)}
                className="text-faint hover:bg-accent-wash hover:text-ink flex h-6 w-6 flex-none cursor-pointer items-center justify-center rounded-md transition-colors duration-150"
              >
                <Icon name="close" size={12} strokeWidth={2} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="ml-auto flex items-center gap-1">
        {actions.map((action) => (
          <div
            key={action.id}
            className="starting:-translate-y-2 starting:opacity-0 motion-safe:transition-[translate,opacity] motion-safe:duration-300 motion-safe:ease-out"
          >
            <button
              type="button"
              title={action.hint ?? action.label}
              disabled={action.disabled}
              onClick={action.onClick}
              className={`${SMALL} px-2.5`}
            >
              <Icon name={action.icon} size={14} className="text-accent" />
              {action.label}
            </button>
          </div>
        ))}
        <div ref={plus}>
          <SurfaceMenu onOpen={onOpenSurface} />
        </div>
      </div>
    </div>
  );
}
