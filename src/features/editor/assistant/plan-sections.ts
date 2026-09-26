import {
  MAX_PAGES,
  blockSchema,
  makeBlock,
  makePage,
  type Block,
  type Page,
} from "@/lib/blocks";
import type { AiPlanSection, AiToolInput } from "@/lib/ai-tools";
import { markdownToDoc } from "@/lib/markdown-doc";
import type { RichBlock } from "@/lib/rich-text-doc";
import { richDocBlocks, sliceRichDoc } from "@/lib/rich-text-split";
import { PaginateError, paginateImport } from "../pdf-import/paginate";
import type { EditContext, EditResult } from "./edit-tools";
import { formatPages } from "./page-numbers";
import { refuse } from "./refusal";

// A long paste's plan, placed (#312): each section becomes a main heading, its
// standfirst and body as text, sub-heads and photos where the plan put them,
// and Import PDF's paginator fits it by the editor's own measurement from the
// top of a fresh page, adding pages as it needs. One call, so one tool result
// and — like any run — one undo step.

/** A body line that is a heading: `#`/`##` a section title, `###` a run-in sub-head. */
const SUBHEAD = /^(#{1,3})\s+(.+?)\s*#*\s*$/;

type Where = "standfirst" | number;

function valid(block: Block, section: AiPlanSection): Block {
  const parsed = blockSchema.safeParse(block);
  if (!parsed.success)
    refuse(
      `section "${section.headline}" has a ${block.type} that isn't valid: ${parsed.error.issues[0]?.message}`,
    );
  return parsed.data!;
}

const textOf = (nodes: RichBlock[]): Block =>
  ({
    ...makeBlock("text"),
    text: sliceRichDoc(nodes, 0, nodes.length),
  }) as Block;

/** One section as blocks, in reading order. Suggestions and notes go to `notes`. */
function sectionBlocks(
  section: AiPlanSection,
  photos: ReadonlySet<string>,
  notes: string[],
): Block[] {
  const ok = (block: Block) => valid(block, section);
  const heading = (title: string, level: "main" | "section" | "paragraph") =>
    ok({
      ...makeBlock("heading"),
      title,
      kicker: level === "main" ? (section.kicker ?? "") : "",
      level,
    } as Block);

  const placed = new Map<Where, Block[]>();
  for (const photo of section.photos ?? []) {
    const at = photo.after ?? "standfirst";
    if (!photo.imageId) {
      notes.push(`Suggested a photo for "${section.headline}"`);
      continue;
    }
    if (!photos.has(photo.imageId))
      refuse(`"${photo.imageId}" isn't a photo uploaded to this issue`);
    const align = photo.align ?? "full";
    const block = ok({
      ...makeBlock("image"),
      imageId: photo.imageId,
      align,
      width: align === "full" ? 100 : 45,
    } as Block);
    placed.set(at, [...(placed.get(at) ?? []), block]);
  }

  const blocks = [heading(section.headline, "main")];
  const markdown = (md: string): RichBlock[] => {
    const result = markdownToDoc(md);
    notes.push(...result.notes.map((n) => `in "${section.headline}", ${n}`));
    return richDocBlocks(result.doc);
  };
  if (section.standfirst?.trim())
    blocks.push(ok(textOf(markdown(section.standfirst))));
  blocks.push(...(placed.get("standfirst") ?? []));

  // The body: text runs broken by sub-heads, and by photos after paragraph n.
  let run: RichBlock[] = [];
  let count = 0;
  const flush = () => {
    if (run.length) blocks.push(ok(textOf(run)));
    run = [];
  };
  const text = (lines: string[]) => {
    const md = lines.join("\n");
    if (!md.trim()) return;
    for (const node of markdown(md)) {
      run.push(node);
      const here = placed.get(++count);
      if (here) {
        flush();
        blocks.push(...here);
      }
    }
  };
  let lines: string[] = [];
  for (const line of section.body.split("\n")) {
    const sub = SUBHEAD.exec(line);
    if (!sub) {
      lines.push(line);
      continue;
    }
    text(lines);
    lines = [];
    flush();
    blocks.push(
      heading(sub[2]!, sub[1]!.length === 3 ? "paragraph" : "section"),
    );
  }
  text(lines);
  flush();
  const late = [...placed].filter(
    ([at]) => typeof at === "number" && at > count,
  );
  if (late.length) {
    blocks.push(...late.flatMap(([, b]) => b));
    notes.push(
      `in "${section.headline}", a photo placed after a paragraph it doesn't have went at the end`,
    );
  }
  return blocks;
}

const WHY: Record<PaginateError["reason"], string> = {
  pages: `the plan needs more pages than an issue can have (${MAX_PAGES})`,
  slow: "fitting it took too long; send fewer sections at a time",
  image: "a photo in it can't be fitted on a page",
  block: "a block in it can't fit on a page on its own",
  limits: "the result would break the issue's content limits",
};

export async function placePlan(
  ctx: EditContext,
  plan: AiToolInput<"propose_sections">,
): Promise<EditResult> {
  const start = plan.after - 1;
  const anchor =
    ctx.pages[start] ??
    refuse(
      `there is no page ${plan.after}; the issue has ${ctx.pages.length} pages`,
    );
  const notes: string[] = [];
  const built = plan.sections.map((s) => sectionBlocks(s, ctx.photos, notes));

  let pages = ctx.pages;
  const reuse = !anchor.cover && anchor.blocks.length === 0;
  let next = reuse ? start : start + 1;
  const written: { headline: string; first: number; last: number }[] = [];
  for (const [i, blocks] of built.entries()) {
    const headline = plan.sections[i]!.headline;
    if (i > 0 || !reuse) {
      if (pages.length >= MAX_PAGES) refuse(WHY.pages);
      pages = [
        ...pages.slice(0, next),
        makePage("blank"),
        ...pages.slice(next),
      ];
    }
    const fitter = await ctx.measure.fitter();
    try {
      const placed = await paginateImport({
        pages,
        index: next,
        selected: null,
        inserted: blocks,
        fits: fitter.fits,
        signal: new AbortController().signal,
      });
      // Only the pages it wrote are new: the rest keep their identity (the
      // paginator hands back parsed copies of every page).
      const wrote = placed.pages.length - pages.length + 1;
      pages = [
        ...pages.slice(0, next),
        ...placed.pages.slice(next, next + wrote),
        ...pages.slice(next + 1),
      ];
      written.push({ headline, first: next, last: placed.curPage });
      next = placed.curPage + 1;
    } catch (error) {
      if (error instanceof PaginateError)
        refuse(
          `section "${headline}" couldn't be placed: ${WHY[error.reason]}`,
        );
      if (error instanceof Error)
        refuse(`section "${headline}" couldn't be placed: ${error.message}`);
      throw error;
    } finally {
      fitter.dispose();
    }
  }

  const span = (w: (typeof written)[number]) =>
    w.first === w.last
      ? `page ${w.first + 1}`
      : `pages ${w.first + 1}–${w.last + 1}`;
  const first = written[0]!.first;
  const last = written.at(-1)!.last;
  const where = written.map((w) => `"${w.headline}" on ${span(w)}`).join("; ");
  const suggested = notes.filter((n) => n.startsWith("Suggested"));
  const other = notes.filter((n) => !n.startsWith("Suggested"));
  return {
    pages,
    text: [
      `Placed ${written.length === 1 ? "1 section" : `${written.length} sections`} on pages ${formatPages(
        Array.from({ length: last - first + 1 }, (_, i) => first + i + 1),
      )}; later pages renumbered: ${where}.`,
      suggested.length &&
        `${suggested.join("; ")}: the author sees each suggestion.`,
      other.length && `Note: ${other.join("; ")}.`,
    ]
      .filter(Boolean)
      .join(" "),
    report: pages.slice(first, last + 1).map((p: Page) => p.id),
    notes: suggested,
  };
}
