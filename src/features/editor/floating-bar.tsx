"use client";

import {
  useLayoutEffect,
  useRef,
  type ComponentProps,
  type ReactNode,
} from "react";

/** Stage padding kept clear of the bar: below it, or beside it when it stands. */
export const TOOLBAR_RESERVE = 92;
const TOOLBAR_CLEARANCE = 34;

// The pill a stage's tools float in — the editor's along the foot of the
// canvas, the PDF panel's along the foot of its stage — and, when the stage is
// too narrow for a row, standing on end at its outer edge instead. The move
// remounts the pill so it slides in from wherever it now lives.
export function FloatingBar({
  vertical,
  side,
  label,
  groupProps,
  wrap = false,
  onReserveChange,
  children,
}: {
  vertical: boolean;
  /** Which edge the standing bar keeps to. */
  side: "left" | "right";
  label: string;
  groupProps?: ComponentProps<"div">;
  /** Let a manually bottom-docked bar use more than one row on a narrow stage. */
  wrap?: boolean;
  /** Reports the space the stage needs to keep clear on the bar's current edge. */
  onReserveChange?: (reserve: number) => void;
  children: ReactNode;
}) {
  const groupRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group || !onReserveChange) return;
    const measure = () =>
      onReserveChange(
        (vertical ? group.offsetWidth : group.offsetHeight) + TOOLBAR_CLEARANCE,
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(group);
    return () => observer.disconnect();
  }, [vertical, onReserveChange]);

  const enter = !vertical
    ? "starting:translate-y-6"
    : side === "left"
      ? "starting:-translate-x-6"
      : "starting:translate-x-6";
  const place = !vertical
    ? "inset-x-0 bottom-0 justify-center px-4 pb-5"
    : side === "left"
      ? "inset-y-0 left-0 items-center pl-4"
      : "inset-y-0 right-0 items-center pr-4";
  return (
    <div
      key={vertical ? "standing" : "lying"}
      className={`pointer-events-none absolute z-30 flex starting:opacity-0 motion-safe:transition-[translate,opacity] motion-safe:duration-300 motion-safe:ease-out ${enter} ${place}`}
    >
      {/* A group, not role="toolbar": that role promises arrow-key navigation
          within one tab stop, and here every button is its own tab stop. */}
      <div
        ref={groupRef}
        role="group"
        aria-label={label}
        data-bar-placement={vertical ? side : "bottom"}
        {...groupProps}
        className={`border-hair-warm pointer-events-auto flex items-center gap-2 rounded-[14px] border bg-white shadow-[0_8px_28px_rgba(40,36,28,0.22)] ${
          vertical
            ? "flex-col px-2 py-2.5"
            : `max-w-full px-2.5 py-2 ${wrap ? "flex-wrap justify-center" : ""}`
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export function BarDivider({ vertical }: { vertical: boolean }) {
  return (
    <span
      className={`bg-line ${vertical ? "my-0.5 h-px w-6" : "mx-0.5 h-6 w-px"}`}
    />
  );
}
