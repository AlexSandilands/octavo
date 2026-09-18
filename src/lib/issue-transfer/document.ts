import { z } from "zod";
import {
  CONTENT_VERSION,
  ensureCoverFirst,
  issueContentSchema,
  type IssueContent,
} from "../blocks";
import {
  THEME_IDS,
  type LayoutThemeId,
} from "@/features/blocks/themes/registry";
import { MAX_DOCUMENT_BYTES } from "./limits";
import { refuse, type Refusal } from "./manifest";

// One bundled `issues/<id>/issue.json`. The authored fields are the editor save
// path's own rules — the same `issueContentSchema`, `ensureCoverFirst`, title
// cap and theme enum — so a document this accepts is one the editor can already
// save. `number` / `status` / `publishedAt` travel for the record only: every
// import arrives as a fresh numberless draft.

export const bundledIssueSchema = z
  .object({
    title: z.string().max(200),
    theme: z.enum(THEME_IDS as [LayoutThemeId, ...LayoutThemeId[]]),
    content: issueContentSchema,
    footerMarkSize: z.number().int().min(0).max(1000),
    footerTextSize: z.number().int().min(0).max(1000),
    logoId: z.string().max(64).nullable(),
    number: z.number().int().nullable(),
    status: z.enum(["draft", "published"]),
    publishedAt: z.string().datetime({ offset: true }).nullable(),
  })
  .strict();

export type BundledIssue = z.infer<typeof bundledIssueSchema>;

export type DocumentCheck =
  | { ok: true; issue: BundledIssue }
  | { ok: false; refusal: Refusal };

/**
 * Parse and check one bundled document. Beyond the save path's rules it adds
 * the three things the stored schema does not say: an upper bound on the
 * document's own `version` (the schema has only `.min(1)`, so a newer document
 * would parse and then render wrong), page and block ids unique within the
 * document (AI-authored content gets this wrong, and the editor's history and
 * cover references key on them), and a serialised size that leaves the document
 * savable.
 */
export function checkBundledIssue(
  value: unknown,
  title: string,
): DocumentCheck {
  const named = title.trim() || "Untitled";
  const parsed = bundledIssueSchema.safeParse(value);
  if (!parsed.success) {
    return {
      ok: false,
      refusal: refuse(
        "invalid-document",
        `“${named}” isn’t a page layout this site can read.`,
      ),
    };
  }

  const issue = parsed.data;
  if (issue.content.version > CONTENT_VERSION) {
    return {
      ok: false,
      refusal: refuse(
        "content-too-new",
        "This export was made by a newer version of the site. Update this site first.",
      ),
    };
  }

  const content: IssueContent = {
    ...issue.content,
    pages: ensureCoverFirst(issue.content.pages),
  };

  const ids = new Set<string>();
  for (const page of content.pages) {
    if (ids.has(page.id)) return { ok: false, refusal: duplicateId(named) };
    ids.add(page.id);
    for (const block of page.blocks) {
      if (ids.has(block.id)) return { ok: false, refusal: duplicateId(named) };
      ids.add(block.id);
    }
  }

  const bytes = new TextEncoder().encode(JSON.stringify(content)).length;
  if (bytes > MAX_DOCUMENT_BYTES) {
    return {
      ok: false,
      refusal: refuse(
        "document-too-large",
        `“${named}” is too big to edit on this site. Split it into two issues and export again.`,
      ),
    };
  }

  return { ok: true, issue: { ...issue, content } };
}

function duplicateId(named: string): Refusal {
  return refuse(
    "duplicate-document-id",
    `“${named}” has two pages or blocks with the same id, so it can’t be edited reliably.`,
  );
}
