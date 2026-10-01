"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Hides a bar's separating rule when it would hang alone: first on a wrapped
 * line (pushing what follows in) or last on one (its neighbour wrapped away).
 * The ref goes on the rule, directly before its neighbour. Measured with the
 * rule shown, on every render and on bar resize.
 */
export function useLoneRule<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const after = el?.nextElementSibling as HTMLElement | null | undefined;
    const bar = el?.parentElement;
    if (!el || !after || !bar) return;
    const check = () => {
      el.style.display = "";
      const before = el.previousElementSibling as HTMLElement | null;
      const first = before ? el.offsetLeft <= before.offsetLeft : false;
      const last = after.offsetLeft <= el.offsetLeft;
      el.style.display = first || last ? "none" : "";
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(bar);
    return () => observer.disconnect();
  });
  return ref;
}
