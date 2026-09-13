import { z } from "zod";
import type { Page } from "@/lib/blocks";
import {
  contentSaveResultSchema,
  metaSaveResultSchema,
} from "@/lib/editor-save";

async function postSave<T extends { ok: boolean }>(
  id: string,
  body: unknown,
  schema: z.ZodType<T>,
) {
  const response = await fetch(
    `/api/admin/issues/${encodeURIComponent(id)}/save`,
    {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  // Validation, missing rows and revision conflicts are expected save results.
  // Auth, infrastructure and malformed responses reach the hook's error reporter.
  if (!response.ok && ![400, 404, 409].includes(response.status)) {
    throw new Error(`Editor save request failed (${response.status})`);
  }
  const result = schema.parse(await response.json());
  if (!response.ok && result.ok) {
    throw new Error(`Unexpected editor save response (${response.status})`);
  }
  return result;
}

export function saveIssue(
  id: string,
  content: { pages: Page[] },
  baseRevision: number,
) {
  return postSave(
    id,
    { kind: "content", content, baseRevision },
    contentSaveResultSchema,
  );
}

export function saveMeta(
  id: string,
  meta: { title?: string; theme?: string; logoId?: string | null },
) {
  return postSave(id, { kind: "meta", meta }, metaSaveResultSchema);
}
