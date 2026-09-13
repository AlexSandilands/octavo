"use client";
import { useLayoutEffect, type RefObject } from "react";

/** Keep unscaled text tools inside the visible canvas, clear of its inspector. */
export function useCoverToolbarBounds(
  ref: RefObject<HTMLDivElement | null>,
  active: boolean,
) {
  useLayoutEffect(() => {
    const toolbar = ref.current;
    const stage = toolbar?.closest<HTMLElement>("[data-editor-canvas-stage]");
    if (!toolbar || !stage || !active) return;
    const inspector = stage.querySelector<HTMLElement>(
      "[data-cover-inspector]",
    );
    const place = () => {
      const stageRect = stage.getBoundingClientRect();
      let left = Math.max(0, stageRect.left) + 8;
      let right = Math.min(window.innerWidth, stageRect.right) - 8;
      const panel = inspector?.getBoundingClientRect();
      if (panel && panel.width && panel.right > left && panel.left < right) {
        const before = Math.max(0, panel.left - 8 - left);
        const after = Math.max(0, right - panel.right - 8);
        if (before >= after) right = Math.max(left, panel.left - 8);
        else left = Math.min(right, panel.right + 8);
      }
      const style = getComputedStyle(toolbar);
      const pageScale = Number(style.getPropertyValue("--page-scale")) || 1;
      const chromeScale = Number(style.getPropertyValue("--chrome-scale")) || 1;
      toolbar.style.maxWidth = `${Math.max(1, right - left) / chromeScale}px`;
      // Left/bottom live in page coordinates; the toolbar cancels the page zoom.
      toolbar.style.left = "0px";
      toolbar.style.bottom = "100%";
      const rect = toolbar.getBoundingClientRect();
      const x = Math.max(left, Math.min(rect.left, right - rect.width));
      const top = Math.max(0, stageRect.top) + 8;
      const bottom = Math.min(window.innerHeight, stageRect.bottom) - 8;
      const y = Math.max(top, Math.min(rect.top, bottom - rect.height));
      toolbar.style.left = `${(x - rect.left) / pageScale}px`;
      toolbar.style.bottom = `calc(100% - ${(y - rect.top) / pageScale}px)`;
    };
    place();
    const resize = new ResizeObserver(place);
    resize.observe(toolbar);
    resize.observe(stage);
    if (inspector) resize.observe(inspector);
    // Pan, zoom, placement and inspector docking already update ancestor styles.
    const mutations = new MutationObserver(place);
    const ancestors = new Set<HTMLElement>();
    for (const start of [toolbar.parentElement, inspector]) {
      for (let el = start; el && stage.contains(el); el = el.parentElement) {
        ancestors.add(el);
        if (el === stage) break;
      }
    }
    ancestors.forEach((el) =>
      mutations.observe(el, {
        attributes: true,
        attributeFilter: ["style", "class"],
      }),
    );
    window.addEventListener("resize", place);
    document.addEventListener("scroll", place, true);
    stage.addEventListener("transitionend", place);
    return () => {
      resize.disconnect();
      mutations.disconnect();
      window.removeEventListener("resize", place);
      document.removeEventListener("scroll", place, true);
      stage.removeEventListener("transitionend", place);
    };
  }, [ref, active]);
}
