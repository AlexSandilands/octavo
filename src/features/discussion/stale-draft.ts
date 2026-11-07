import { z } from "zod";
import {
  COMMENT_BODY_MAX,
  REPORT_NOTE_MAX,
  REPORT_REASONS,
} from "@/lib/comments";

// What a member was writing when a Server Action failed because the page
// outlived a deploy (#132): kept in sessionStorage across the reload the
// notice asks for, then put back once and forgotten. Nothing is stored in
// normal use; every storage call may throw (private mode, quota) and is caught.

const body = z.string().max(COMMENT_BODY_MAX);
const id = z.string().min(1).max(64);
const newName = z.string().max(200).nullable();

const draftSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("comment"),
    body,
    /** The tagged page's id. */
    pageId: id.nullable(),
    newName,
  }),
  z.object({ kind: z.literal("reply"), parentId: id, body, newName }),
  z.object({ kind: z.literal("edit"), commentId: id, body }),
  z.object({
    kind: z.literal("report"),
    commentId: id,
    reason: z.enum(REPORT_REASONS).nullable(),
    note: z.string().max(REPORT_NOTE_MAX),
  }),
]);

export type StaleDraft = z.infer<typeof draftSchema>;

const recordSchema = z.object({
  savedAt: z.number(),
  draft: draftSchema,
});

/** A draft older than this is dropped rather than put back. */
export const STALE_DRAFT_TTL = 30 * 60 * 1000;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const keyFor = (issueNo: number) => `octavo:stale-draft:${issueNo}`;
const session = (): Store => window.sessionStorage;

/** Keeps the draft for the reload; false when the browser won't store it. */
export function stashDraft(
  issueNo: number,
  draft: StaleDraft,
  store: () => Store = session,
  now = Date.now(),
): boolean {
  try {
    store().setItem(keyFor(issueNo), JSON.stringify({ savedAt: now, draft }));
    return true;
  } catch {
    return false;
  }
}

/** The kept draft, removed as it is read; null when none is fit to restore. */
export function takeDraft(
  issueNo: number,
  store: () => Store = session,
  now = Date.now(),
): StaleDraft | null {
  let raw: string | null;
  try {
    const s = store();
    raw = s.getItem(keyFor(issueNo));
    if (raw !== null) s.removeItem(keyFor(issueNo));
  } catch {
    return null;
  }
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const record = recordSchema.safeParse(parsed);
  if (!record.success) return null;
  const age = now - record.data.savedAt;
  return age >= 0 && age <= STALE_DRAFT_TTL ? record.data.draft : null;
}
