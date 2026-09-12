import { useRef, useState } from "react";
import type { EditorSnapshot } from "../use-editor-history";
import type { MeasurementOptions } from "./measure";
import type { DropTarget } from "./drag-out";
import { boundedWait, type ReviewItem, type SourceMapping } from "./model";
import type { UploadCache } from "./upload";

export function usePdfInsertion(
  options: MeasurementOptions &
    EditorSnapshot & {
      issueId: string;
      flushSave: () => Promise<boolean>;
      applyImport: (
        expected: EditorSnapshot["pages"],
        next: EditorSnapshot,
      ) => boolean;
      registerImages: (images: MeasurementOptions["images"]) => void;
    },
) {
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const latest = useRef(options);
  // Keep asynchronous completion checks ahead of effects and queued saves.
  // eslint-disable-next-line react-hooks/refs
  latest.current = options;
  const add = async (
    items: ReviewItem[],
    signal: AbortSignal,
    uploads: UploadCache,
    /** A drop's exact place; otherwise after the selected block on the current page. */
    target?: DropTarget,
  ): Promise<SourceMapping> => {
    if (lock.current) throw new Error("An import is already running.");
    lock.current = true;
    const batchController = new AbortController();
    signal = AbortSignal.any([signal, batchController.signal]);
    setPending(true);
    const captured = latest.current;
    const urls: string[] = [];
    let dispose: () => void = () => {};
    const valid = () => {
      if (signal.aborted)
        throw new Error(
          "Cancelled. The issue is unchanged; completed uploads can be reused on retry.",
        );
      if (
        latest.current.pages !== captured.pages ||
        latest.current.theme !== captured.theme ||
        JSON.stringify(latest.current.logo) !== JSON.stringify(captured.logo) ||
        JSON.stringify(latest.current.settings) !==
          JSON.stringify(captured.settings)
      )
        throw new Error(
          "The document changed while importing. Review the destination and try again.",
        );
    };
    try {
      valid();
      const [
        { synthesize },
        { createMeasurer },
        { paginateImport },
        { uploadSelection },
      ] = await Promise.all([
        import("./synthesis"),
        import("./measure"),
        import("./paginate"),
        import("./upload"),
      ]);
      valid();
      const batch = synthesize(items);
      const localImages = { ...captured.images };
      for (const item of items)
        if (item.block.type === "image" && item.region.image) {
          const cached = uploads.get(item.region.image.blob);
          const url = URL.createObjectURL(item.region.image.blob);
          urls.push(url);
          localImages[item.block.imageId ?? item.id] = {
            url: cached?.url ?? url,
            width: cached?.width ?? item.region.image.width,
            height: cached?.height ?? item.region.image.height,
          };
        }
      const measurer = await createMeasurer(
        { ...captured, images: localImages },
        signal,
      );
      dispose = measurer.dispose;
      const destination = {
        pages: captured.pages,
        index: target?.page ?? captured.curPage,
        selected: captured.sel,
        position: target?.position,
        signal,
      };
      let staged = await paginateImport({
        ...destination,
        inserted: batch.blocks,
        fits: measurer.fits,
      });
      dispose();
      dispose = () => {};
      valid();
      if (!(await boundedWait(captured.flushSave(), signal)))
        throw new Error(
          "Save the issue successfully before adding this selection. Use Retry or reload after a conflict.",
        );
      valid();
      const uploaded = await boundedWait(
        uploadSelection(items, captured.issueId, uploads, signal),
        signal,
      );
      valid();
      if (Object.keys(uploaded.images).length) {
        const blocks = batch.blocks.map((block) =>
          block.type === "image" &&
          block.imageId &&
          uploaded.replacements[block.imageId]
            ? { ...block, imageId: uploaded.replacements[block.imageId] }
            : block,
        );
        const finalMeasurer = await createMeasurer(
          { ...captured, images: { ...captured.images, ...uploaded.images } },
          signal,
        );
        dispose = finalMeasurer.dispose;
        // Reflow the original destination and unsplit selection: upload rounding
        // can change page breaks, image sizing and source-to-block mappings.
        staged = await paginateImport({
          ...destination,
          inserted: blocks,
          fits: finalMeasurer.fits,
        });
      }
      valid();
      captured.registerImages(uploaded.images);
      if (
        !latest.current.applyImport(captured.pages, {
          pages: staged.pages,
          sel: staged.sel,
          curPage: staged.curPage,
        })
      )
        throw new Error("The document changed. Try adding again.");
      return Object.fromEntries(
        Object.entries(batch.mapping).map(([source, ids]) => [
          source,
          ids.flatMap((id) => staged.splitMap[id] ?? [id]),
        ]),
      );
    } finally {
      batchController.abort();
      dispose();
      for (const url of urls) URL.revokeObjectURL(url);
      lock.current = false;
      setPending(false);
    }
  };
  return { pending, add };
}
