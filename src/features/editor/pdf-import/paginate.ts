import {
  MAX_PAGES,
  makePage,
  issueContentSchema,
  type Block,
  type Page,
} from "@/lib/blocks";
import { createId } from "@/lib/id";
import { pageFillsCanvas } from "@/features/blocks/layout";
import { stringToDoc, type RichDoc } from "@/lib/rich-text-doc";
import { cutParagraph, paragraphLength } from "./synthesis";
import { checkAbort } from "./model";

type TextBlock = Extract<Block, { type: "text" }>;
export type Fits = (blocks: Block[], bleed?: boolean) => Promise<boolean>;
function safeOffset(text: string, at: number) {
  const c = text.charCodeAt(at - 1),
    next = text.charCodeAt(at);
  return c >= 0xd800 && c <= 0xdbff && next >= 0xdc00 && next <= 0xdfff
    ? at - 1
    : at;
}
async function splitText(
  block: TextBlock,
  prefix: Block[],
  fits: Fits,
): Promise<[TextBlock, TextBlock] | null> {
  const doc =
    typeof block.text === "string" ? stringToDoc(block.text) : block.text;
  const candidate = (content: RichDoc["content"]): TextBlock => ({
    ...block,
    text: { type: "doc", content },
  });
  let low = 0,
    high = doc.content.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (await fits([...prefix, candidate(doc.content.slice(0, mid))]))
      low = mid;
    else high = mid - 1;
  }
  if (low > 0 && low < doc.content.length)
    return [
      candidate(doc.content.slice(0, low)),
      { ...candidate(doc.content.slice(low)), id: createId() },
    ];
  const first = doc.content[0];
  if (!first || first.type !== "paragraph") return null;
  const plain = (first.content ?? [])
    .map((n) => (n.type === "text" ? n.text : "\n"))
    .join("");
  const length = paragraphLength(first);
  const cuts = [...plain.matchAll(/\s+/gu)]
    .map((m) => m.index! + m[0].length)
    .filter((n) => n > 0 && n < length);
  // A long unbroken token needs a Unicode-safe character cut to make progress.
  if (!cuts.length)
    for (let i = 1; i < length; i++)
      if (safeOffset(plain, i) === i) cuts.push(i);
  low = 0;
  high = cuts.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const [left] = cutParagraph(first, cuts[mid - 1]!);
    if (await fits([...prefix, candidate([left])])) low = mid;
    else high = mid - 1;
  }
  if (!low) return null;
  const [left, right] = cutParagraph(first, cuts[low - 1]!);
  return [
    candidate([left]),
    { ...candidate([right, ...doc.content.slice(1)]), id: createId() },
  ];
}

/** Only the destination is flowed. Later authored pages remain untouched. */
export async function paginateImport({
  pages,
  index,
  selected,
  inserted,
  fits,
  signal,
}: {
  pages: Page[];
  index: number;
  selected: string | null;
  inserted: Block[];
  fits: Fits;
  signal: AbortSignal;
}) {
  const destination = pages[index];
  if (!destination) throw new Error("Choose a destination page.");
  const separate = Boolean(destination.cover) || pageFillsCanvas(destination);
  const at = separate
    ? -1
    : destination.blocks.findIndex((b) => b.id === selected);
  const position = at < 0 ? destination.blocks.length : at + 1;
  const sequence = separate
    ? inserted
    : [
        ...destination.blocks.slice(0, position),
        ...inserted,
        ...destination.blocks.slice(position),
      ];
  const queue = sequence.map((block) => ({ block, origin: block.id }));
  const output: Page[] = [];
  let current: Page = separate
    ? makePage("blank")
    : { ...destination, blocks: [] };
  const splitMap: Record<string, string[]> = {};
  let steps = 0;
  const started = performance.now();
  const maxNew = MAX_PAGES - pages.length + (separate ? 0 : 1);
  const finish = () => {
    if (current.blocks.length) {
      output.push(current);
      current = makePage("blank");
    }
    if (output.length >= maxNew && queue.length)
      throw new Error(
        "This import needs more than 200 magazine pages. Add less content or remove a page first.",
      );
  };
  const append = (block: Block, origin: string) => {
    current.blocks.push(block);
    (splitMap[origin] ??= []).push(block.id);
  };
  while (queue.length) {
    checkAbort(signal);
    if (++steps > 3000 || performance.now() - started > 30_000)
      throw new Error(
        "Could not finish fitting this batch. Select fewer regions and retry.",
      );
    const next = queue[0]!;
    if (current.blocks.length >= 100) {
      finish();
      continue;
    }
    if (next.block.type === "heading" && queue[1] && current.blocks.length) {
      const following = queue[1].block;
      if (!(await fits([...current.blocks, next.block, following]))) {
        const firstPart =
          following.type === "text"
            ? await splitText(following, [...current.blocks, next.block], fits)
            : null;
        if (!firstPart) {
          finish();
          continue;
        }
      }
    }
    if (await fits([...current.blocks, next.block])) {
      append(next.block, next.origin);
      queue.shift();
      continue;
    }
    if (next.block.type === "text") {
      const split = await splitText(next.block, current.blocks, fits);
      if (split) {
        append(split[0], next.origin);
        queue[0] = { block: split[1], origin: next.origin };
        finish();
        continue;
      }
    }
    if (current.blocks.length) {
      finish();
      continue;
    }
    if (next.block.type === "image") {
      let image = next.block;
      for (let width = image.width - 5; width >= 20; width -= 5) {
        const resized = { ...image, width };
        if (await fits([resized])) {
          image = resized;
          break;
        }
      }
      if (await fits([image])) {
        append(image, next.origin);
        queue.shift();
        continue;
      }
      const fit = { ...image, align: "page-fit" as const, caption: "" };
      if (!(await fits([fit], true)))
        throw new Error("This image cannot be fitted. Choose a smaller image.");
      append(fit, next.origin);
      queue.shift();
      finish();
      continue;
    }
    throw new Error(
      "A block cannot fit on a page. Shorten its heading or split its text in the review tray.",
    );
  }
  finish();
  const result = separate
    ? [...pages.slice(0, index + 1), ...output, ...pages.slice(index + 1)]
    : [...pages.slice(0, index), ...output, ...pages.slice(index + 1)];
  const parsed = issueContentSchema.safeParse({ pages: result });
  if (!parsed.success)
    throw new Error(
      "This batch exceeds magazine content limits. Select a smaller batch.",
    );
  const last = splitMap[inserted.at(-1)!.id]?.at(-1) ?? null;
  return {
    pages: parsed.data.pages,
    sel: last,
    curPage: Math.max(
      0,
      result.findIndex((p) => p.blocks.some((b) => b.id === last)),
    ),
    splitMap,
  };
}
