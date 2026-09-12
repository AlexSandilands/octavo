import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ensureCoverFirst, issueContentSchema } from "@/lib/blocks";
import type { SaveResult } from "@/lib/editor-save";
import {
  THEME_IDS,
  type LayoutThemeId,
} from "@/features/blocks/themes/registry";
import { updateIssueContent, updateIssueMeta } from "./issues";

const idSchema = z.string().uuid();

// Accept every known theme, including ones disabled in this deployment.
// An absent logoId leaves the mark alone; null explicitly clears it.
const metaSchema = z
  .object({
    title: z.string().max(200).optional(),
    theme: z.enum(THEME_IDS as [LayoutThemeId, ...LayoutThemeId[]]).optional(),
    logoId: idSchema.nullable().optional(),
  })
  .strict();

const saveSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("content"),
      content: issueContentSchema,
      baseRevision: z.number().int().min(0),
    })
    .strict(),
  z.object({ kind: z.literal("meta"), meta: metaSchema }).strict(),
]);

// The route authenticates before reading the body or calling this routine.
export async function saveEditorIssue(
  id: unknown,
  input: unknown,
): Promise<SaveResult | { ok: true }> {
  const parsedId = idSchema.safeParse(id);
  const parsedSave = saveSchema.safeParse(input);
  if (!parsedId.success || !parsedSave.success) {
    return { ok: false, reason: "invalid" };
  }
  const save = parsedSave.data;
  if (save.kind === "content") {
    return updateIssueContent(
      parsedId.data,
      { ...save.content, pages: ensureCoverFirst(save.content.pages) },
      save.baseRevision,
    );
  }
  await updateIssueMeta(parsedId.data, save.meta);
  revalidatePath("/admin");
  return { ok: true };
}
