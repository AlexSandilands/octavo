import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { PageFrame, PAGE_H, PAGE_W } from "@/features/blocks/page-frame";
import { MeasurementBlocks } from "./measurement-blocks";
import { PageBlocks } from "@/features/blocks/page-blocks";
import type { LayoutTheme } from "@/features/blocks/themes/registry";
import type { Block } from "@/lib/blocks";
import type { ImageMap, ResolvedImage } from "@/lib/images";
import type { SiteSettings } from "@/lib/branding";
import type { SponsorMap } from "@/lib/sponsors";
import { checkAbort, yieldTask, boundedWait } from "./model";

export type MeasurementOptions = {
  theme: LayoutTheme;
  images: ImageMap;
  sponsors: SponsorMap;
  settings: SiteSettings;
  logo: ResolvedImage | null;
  issueNo: number;
};
export async function createMeasurer(
  options: MeasurementOptions,
  signal: AbortSignal,
) {
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.inert = true;
  Object.assign(host.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: `${PAGE_W}px`,
    visibility: "hidden",
    pointerEvents: "none",
  });
  document.body.append(host);
  const root = createRoot(host);
  let attempts = 0;
  const started = performance.now();
  try {
    await boundedWait(document.fonts.ready, signal);
  } catch (error) {
    root.unmount();
    host.remove();
    throw error;
  }
  return {
    fits: async (blocks: Block[], bleed = false) => {
      checkAbort(signal);
      if (++attempts > 3000 || performance.now() - started > 30_000)
        throw new Error("Layout took too long. Try a smaller selection.");
      const render = (editable = false) =>
        flushSync(() =>
          root.render(
            <PageFrame
              theme={options.theme}
              w={PAGE_W}
              h={PAGE_H}
              issueNo={options.issueNo}
              pageNo={1}
              logo={options.logo}
              settings={options.settings}
              bleed={bleed}
              clip={false}
            >
              {editable ? (
                <MeasurementBlocks
                  key={attempts}
                  blocks={blocks}
                  options={options}
                />
              ) : (
                <PageBlocks
                  page={{ id: "measure", blocks }}
                  theme={options.theme}
                  images={options.images}
                  sponsors={options.sponsors}
                />
              )}
            </PageFrame>,
          ),
        );
      render();
      for (const img of host.querySelectorAll("img")) {
        if (!img.complete) {
          img.loading = "eager";
          await boundedWait(
            img.decode().catch(() => {
              throw new Error(
                "Could not load an image for layout. Retry when images are available.",
              );
            }),
            signal,
            5000,
          );
        }
      }
      for (const img of host.querySelectorAll("img"))
        if (!img.naturalWidth)
          throw new Error(
            "An image could not be loaded for fitting. Retry when it is available.",
          );
      await boundedWait(document.fonts.ready, signal);
      if (attempts % 12 === 0) await yieldTask();
      checkAbort(signal);
      if (bleed) return true;
      const frame = host.querySelector<HTMLElement>("[data-page-frame]")!;
      const footer = host.querySelector<HTMLElement>("[data-page-footer]")!;
      const limit = footer.offsetTop - 6;
      const fitsRendered = () => {
        for (const block of host.querySelectorAll<HTMLElement>(
          "[data-reader-block]",
        )) {
          for (const text of block.querySelectorAll<HTMLElement>("p,h1,h2,h3"))
            if (text.scrollWidth > text.clientWidth + 1) return false;
          if (
            block.getBoundingClientRect().bottom -
              frame.getBoundingClientRect().top >
            limit + 0.5
          )
            return false;
        }
        return true;
      };
      for (const body of host.querySelectorAll(".rich-text"))
        body.classList.remove("ProseMirror");
      if (!fitsRendered()) return false;
      render(true);
      await boundedWait(document.fonts.ready, signal);
      // Tiptap preserves wrapping spaces and disables ligatures. Measure that
      // actual editor stylesheet as well as the shared reader/print rendering.
      for (const body of host.querySelectorAll(".rich-text"))
        body.classList.add("ProseMirror");
      return fitsRendered();
    },
    dispose: () => {
      root.unmount();
      host.remove();
    },
  };
}
