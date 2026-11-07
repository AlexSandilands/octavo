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
  /** The page load that kept it: only a later load (the reload) restores it. */
  load: z.string(),
  draft: draftSchema,
});

/** A draft older than this is dropped rather than put back. */
export const STALE_DRAFT_TTL = 30 * 60 * 1000;

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
/** Injectable for the check script; the browser's own by default. */
export type DraftEnv = { store?: () => Store; now?: number; load?: string };

const keyFor = (issueNo: number) => `octavo:stale-draft:${issueNo}`;
const THIS_LOAD = Math.random().toString(36).slice(2);
const session = (): Store => window.sessionStorage;

/** Keeps the draft for the reload; false when the browser won't store it. */
export function stashDraft(
  issueNo: number,
  draft: StaleDraft,
  { store = session, now = Date.now(), load = THIS_LOAD }: DraftEnv = {},
): boolean {
  try {
    store().setItem(
      keyFor(issueNo),
      JSON.stringify({ savedAt: now, load, draft }),
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * The kept draft, removed as it is read; null when none is fit to restore.
 * One kept by this same page load (the thread closed and opened again before
 * the reload) is left where it is for the reload.
 */
export function takeDraft(
  issueNo: number,
  { store = session, now = Date.now(), load = THIS_LOAD }: DraftEnv = {},
): StaleDraft | null {
  try {
    const s = store();
    const raw = s.getItem(keyFor(issueNo));
    if (raw === null) return null;
    const record = recordSchema.safeParse(parse(raw));
    if (record.success && record.data.load === load) return null;
    s.removeItem(keyFor(issueNo));
    if (!record.success) return null;
    const age = now - record.data.savedAt;
    return age >= 0 && age <= STALE_DRAFT_TTL ? record.data.draft : null;
  } catch {
    return null;
  }
}

function parse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
