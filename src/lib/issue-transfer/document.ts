import { z } from "zod";
import {
  CONTENT_VERSION,
  ensureCoverFirst,
  issueContentSchema,
  type IssueContent,
} from "../blocks";
import { ISSUE_TITLE_MAX } from "../editor-save";
import { themeIdSchema } from "@/features/blocks/themes/registry";
import { MAX_DOCUMENT_BYTES } from "./limits";
import { refuse, type Refusal } from "./manifest";

// One bundled `issues/<id>/issue.json`: the editor save path's own rules, plus
// the three things the stored schema does not say (see checkBundledIssue).
// `number` / `status` / `publishedAt` travel for the record only.

export const bundledIssueSchema = z
  .object({
    title: z.string().max(ISSUE_TITLE_MAX),
    theme: themeIdSchema,
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

const TOO_NEW = refuse(
  "content-too-new",
  "This export was made by a newer version of the site. Update this site first.",
);

/**
 * Parse and check one bundled document. Beyond the save path's rules it adds an
 * upper bound on the document's own `version` (the stored schema has only
 * `.min(1)`), ids unique within the document (the editor's history and the
 * cover's references key on them, and AI-authored content gets this wrong), and
 * a serialised size that leaves the document savable.
 */
export function checkBundledIssue(
  value: unknown,
  title: string,
): DocumentCheck {
  const named = title.trim() || "Untitled";

  // Before the schema, not after: a document from a newer content model usually
  // carries something this parse rejects — a block type, a widened enum — and
  // would be refused as unreadable rather than as too new.
  const declared = declaredVersion(value);
  if (declared !== null && declared > CONTENT_VERSION) {
    return { ok: false, refusal: TOO_NEW };
  }

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
    return { ok: false, refusal: TOO_NEW };
  }

  const content: IssueContent = {
    ...issue.content,
    pages: ensureCoverFirst(issue.content.pages),
  };

  const duplicate = firstDuplicateId(content);
  if (duplicate) return { ok: false, refusal: duplicateId(named) };

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

function declaredVersion(value: unknown): number | null {
  const content = (value as { content?: unknown } | null)?.content;
  const version = (content as { version?: unknown } | null)?.version;
  return typeof version === "number" ? version : null;
}

// Pages, blocks, cover elements and the stories inside them: everything the
// editor addresses by id.
function firstDuplicateId(content: IssueContent): string | null {
  const seen = new Set<string>();
  const take = (id: string) => {
    if (seen.has(id)) return id;
    seen.add(id);
    return null;
  };
  for (const page of content.pages) {
    const clash =
      take(page.id) ??
      page.blocks.reduce<string | null>(
        (found, b) => found ?? take(b.id),
        null,
      );
    if (clash) return clash;
    for (const element of page.coverElements ?? []) {
      const inner =
        take(element.id) ??
        (element.type === "story"
          ? element.items.reduce<string | null>(
              (found, item) => found ?? take(item.id),
              null,
            )
          : null);
      if (inner) return inner;
    }
  }
  return null;
}

function duplicateId(named: string): Refusal {
  return refuse(
    "duplicate-document-id",
    `“${named}” uses the same id twice, so it can’t be edited reliably.`,
  );
}
