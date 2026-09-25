// Whether a case's task was done (#315): the checks its fixture declares in
// `expect.done`, read off the final pages. They test the shape the
// expectation asks for (a list, a photo placed with its caption, new pages
// under main headings), so a run that changed nothing can't pass; whether
// it reads well still takes a human look.
import { z } from "zod";
import type { Block, Page } from "../../src/lib/blocks.ts";
import { richTextToPlain } from "../../src/lib/rich-text-doc.ts";

export const checkSchema = z.discriminatedUnion("check", [
  /** Something changed: a block added, edited, moved or removed. */
  z.object({ check: z.literal("changed") }),
  /** The reply says something (a question-only case). */
  z.object({ check: z.literal("answered") }),
  /** At least `min` heading blocks on the page, or new anywhere. */
  z.object({
    check: z.literal("headings"),
    page: z.number().int().optional(),
    level: z.enum(["main", "section", "paragraph"]).optional(),
    min: z.number().int(),
    new: z.boolean().optional(),
  }),
  /** Paragraphs and list items across the page's text: separate items. */
  z.object({
    check: z.literal("paragraphs"),
    page: z.number().int(),
    min: z.number().int(),
  }),
  /** Text blocks on the page, within bounds. */
  z.object({
    check: z.literal("textBlocks"),
    page: z.number().int(),
    min: z.number().int().optional(),
    max: z.number().int().optional(),
  }),
  /** A bulleted or numbered list on the page. */
  z.object({ check: z.literal("list"), page: z.number().int() }),
  /** A photo placed as asked; `afterText` is the page's nth text block. */
  z.object({
    check: z.literal("image"),
    imageId: z.string(),
    align: z.enum(["full", "left", "right"]).optional(),
    caption: z.string().optional(),
    afterText: z.number().int().optional(),
  }),
  z.object({ check: z.literal("pagesAdded"), min: z.number().int() }),
  /** Some text on the page says this (case-insensitive). */
  z.object({
    check: z.literal("textContains"),
    page: z.number().int(),
    text: z.string(),
  }),
  /** Only the page's nth text block changed, and nothing else. */
  z.object({
    check: z.literal("onlyText"),
    page: z.number().int(),
    text: z.number().int(),
  }),
]);
export type Check = z.infer<typeof checkSchema>;

type Ctx = { before: Page[]; after: Page[]; reply: string };

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
const texts = (p: Page | undefined) =>
  (p?.blocks ?? []).filter(
    (b): b is Extract<Block, { type: "text" }> => b.type === "text",
  );
const docOf = (b: Extract<Block, { type: "text" }>) =>
  typeof b.text === "string" ? null : b.text;
const blockIds = (pages: Page[]) =>
  new Map(
    pages.flatMap((p) =>
      p.blocks.map((b) => [b.id, JSON.stringify(b)] as const),
    ),
  );

/** Null when the check holds, else why not. */
function failure(check: Check, { before, after, reply }: Ctx): string | null {
  const page =
    "page" in check && check.page ? after[check.page - 1] : undefined;
  switch (check.check) {
    case "changed": {
      const a = blockIds(before);
      const b = blockIds(after);
      const same =
        a.size === b.size &&
        [...a].every(([id, json]) => b.get(id) === json) &&
        before.length === after.length &&
        before.every(
          (p, i) =>
            p.blocks.map((x) => x.id).join() ===
            after[i]?.blocks.map((x) => x.id).join(),
        );
      return same ? "nothing changed" : null;
    }
    case "answered":
      return reply.trim() ? null : "no reply";
    case "headings": {
      const old = new Set(before.flatMap((p) => p.blocks.map((b) => b.id)));
      const pool = page ? [page] : after;
      const n = pool
        .flatMap((p) => p.blocks)
        .filter(
          (b) =>
            b.type === "heading" &&
            (!check.level || (b.level ?? "main") === check.level) &&
            (!check.new || !old.has(b.id)),
        ).length;
      return n >= check.min
        ? null
        : `${n} ${check.new ? "new " : ""}${check.level ?? ""} headings (want ≥ ${check.min})`;
    }
    case "paragraphs": {
      const n = texts(page).reduce((sum, b) => {
        const doc = docOf(b);
        if (!doc) return sum + 1;
        return (
          sum +
          doc.content.reduce(
            (s, node) =>
              s +
              ("content" in node &&
              (node.type === "bulletList" || node.type === "orderedList")
                ? (node.content?.length ?? 0)
                : 1),
            0,
          )
        );
      }, 0);
      return n >= check.min
        ? null
        : `${n} paragraphs or items on page ${check.page} (want ≥ ${check.min})`;
    }
    case "textBlocks": {
      const n = texts(page).length;
      if (check.min !== undefined && n < check.min)
        return `${n} text blocks on page ${check.page} (want ≥ ${check.min})`;
      if (check.max !== undefined && n > check.max)
        return `${n} text blocks on page ${check.page} (want ≤ ${check.max})`;
      return null;
    }
    case "list":
      return texts(page).some((b) =>
        docOf(b)?.content.some(
          (n) => n.type === "bulletList" || n.type === "orderedList",
        ),
      )
        ? null
        : `no list on page ${check.page}`;
    case "image": {
      for (const p of after) {
        const i = p.blocks.findIndex(
          (b) => b.type === "image" && b.imageId === check.imageId,
        );
        const b = p.blocks[i];
        if (!b || b.type !== "image") continue;
        if (check.align && b.align !== check.align)
          return `${check.imageId} is ${b.align}, not ${check.align}`;
        if (check.caption && words(b.caption) !== words(check.caption))
          return `${check.imageId}'s caption is "${b.caption}"`;
        if (check.afterText !== undefined) {
          const textIdx = p.blocks
            .map((x, j) => (x.type === "text" ? j : -1))
            .filter((j) => j >= 0);
          const anchor = textIdx[check.afterText - 1];
          if (anchor === undefined || i < anchor)
            return `${check.imageId} isn't after text block ${check.afterText}`;
        }
        return null;
      }
      return `${check.imageId} isn't placed`;
    }
    case "pagesAdded":
      return after.length - before.length >= check.min
        ? null
        : `${after.length - before.length} pages added (want ≥ ${check.min})`;
    case "textContains":
      return texts(page).some((b) =>
        richTextToPlain(b.text)
          .toLowerCase()
          .includes(check.text.toLowerCase()),
      )
        ? null
        : `page ${check.page} doesn't say "${check.text}"`;
    case "onlyText": {
      const target = texts(before[check.page - 1])[check.text - 1];
      const a = blockIds(before);
      const b = blockIds(after);
      const changed = [...new Set([...a.keys(), ...b.keys()])].filter(
        (id) => a.get(id) !== b.get(id),
      );
      if (!target || !changed.includes(target.id))
        return `text block ${check.text} on page ${check.page} is unchanged`;
      return changed.length === 1
        ? null
        : `${changed.length} blocks changed, not just the one`;
    }
  }
}

/** Every declared check that failed, as "done: <why>". */
export function doneFailures(checks: Check[], ctx: Ctx): string[] {
  return checks.flatMap((c) => {
    const why = failure(c, ctx);
    return why ? [`not done: ${why}`] : [];
  });
}

// Structural edits a reply says it made ("I then removed…"), and the tools
// that could have made them. Wording inside a block is set_text's, and offers
// ("if you'd like it removed") aren't claims, so only first-person edits of
// whole blocks and pages count.
const I = String.raw`\bI(?:'ve| have)?(?: also| then| now)? `;
const CLAIMS: { said: RegExp; what: string; tools: string[] }[] = [
  {
    said: new RegExp(
      `${I}(?:removed|deleted)\\b[^.]*\\b(?:blocks?|paragraphs|headings?|photos?|images?)\\b`,
      "i",
    ),
    what: "removed blocks",
    tools: ["delete_block"],
  },
  {
    said: new RegExp(`${I}moved\\b[^.]*\\bpage`, "i"),
    what: "moved a block",
    tools: ["move_block", "split_page"],
  },
  {
    said: new RegExp(
      `${I}(?:split|carried)\\b[^.]*\\bonto\\b[^.]*\\bpage`,
      "i",
    ),
    what: "split a page",
    tools: ["split_page", "move_block"],
  },
  {
    said: new RegExp(`${I}added\\b[^.]*\\bpages?\\b`, "i"),
    what: "added pages",
    tools: ["add_page", "split_page"],
  },
];

/** Edits the reply says it made that no tool made, as "reply claims …". */
export function claimFailures(
  reply: string,
  calls: { name: string; mutated: boolean }[],
): string[] {
  const made = new Set(calls.filter((c) => c.mutated).map((c) => c.name));
  return CLAIMS.filter(
    (c) => c.said.test(reply) && !c.tools.some((t) => made.has(t)),
  ).map(
    (c) =>
      `reply claims an edit no tool made: ${c.what} (no ${c.tools.join(" / ")})`,
  );
}
