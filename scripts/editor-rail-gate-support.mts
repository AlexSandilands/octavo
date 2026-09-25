import type { Page } from "playwright";

/** The editor rail's buttons, top to bottom as they sit on screen. */
export const railOrder = (page: Page) =>
  page.$$eval('nav[aria-label="Editor panels"] button', (els) =>
    els
      .map((el) => ({
        label: el.getAttribute("aria-label"),
        top: el.getBoundingClientRect().top,
      }))
      .sort((a, b) => a.top - b.top)
      .map((b) => b.label)
      .join(", "),
  );
