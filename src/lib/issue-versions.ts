import { z } from "zod";
import type { IssueContent } from "./blocks";

// Draft version history (aboard #51): when the save path keeps the pages it is
// about to overwrite. Pure, so scripts/check-issue-versions.mts can pin every
// edge; src/server/issues.ts supplies the facts from the row it locked.

export const VERSION_REASONS = [
  "session",
  "hourly",
  "large-removal",
  "before-restore",
] as const;
export type VersionReason = (typeof VERSION_REASONS)[number];

/** How many versions an issue keeps; older ones are pruned on the next write. */
export const KEEP_VERSIONS = 10;

/** A save after this long a pause starts a new sitting, so the last one is kept. */
export const SESSION_GAP_MS = 30 * 60 * 1000;
/** Within one long sitting, keep at least one version an hour. */
export const HOURLY_MS = 60 * 60 * 1000;
/** A save that removes this many pages… */
export const LARGE_REMOVAL_PAGES = 2;
/** …or this share of the blocks (and at least LARGE_REMOVAL_MIN_BLOCKS of them). */
export const LARGE_REMOVAL_SHARE = 0.25;
export const LARGE_REMOVAL_MIN_BLOCKS = 3;
/** Pages deleted one at a time within this long of a kept removal are one streak. */
export const REMOVAL_STREAK_MS = 10 * 60 * 1000;

export type ContentCounts = { pages: number; blocks: number };

export function countContent(content: IssueContent): ContentCounts {
  return {
    pages: content.pages.length,
    blocks: content.pages.reduce((sum, page) => sum + page.blocks.length, 0),
  };
}

export type SaveFacts = {
  now: Date;
  /** When the content being overwritten was saved (the row's updatedAt). */
  lastSavedAt: Date;
  /** The newest version's createdAt, or null if the issue has none. */
  newestVersionAt: Date | null;
  /** The newest version's counts: pages deleted one save at a time add up. */
  newestCounts: ContentCounts | null;
  /** Why the newest version was kept, or null if the issue has none. */
  newestReason: VersionReason | null;
  /** When the issue was created: the hourly clock's start before any version. */
  issueCreatedAt: Date;
  /** Whether a version of the revision being overwritten already exists. */
  revisionKept: boolean;
  before: ContentCounts;
  after: ContentCounts;
};

/** Why to keep the content a save is about to overwrite, or null to keep nothing.
 *  A large removal outranks the time rules, so History names the incident case.
 *  It counts against the newest version too, so pages deleted one autosave at a
 *  time still add up to one — once per streak, not once per further page. */
export function versionReason(facts: SaveFacts): VersionReason | null {
  if (facts.revisionKept) return null;
  if (
    isLargeRemoval(facts.before, facts.after) ||
    (facts.newestCounts &&
      !inRemovalStreak(facts) &&
      isLargeRemoval(facts.newestCounts, facts.after))
  ) {
    return "large-removal";
  }
  const now = facts.now.getTime();
  if (now - facts.lastSavedAt.getTime() >= SESSION_GAP_MS) return "session";
  const hourlyFrom = facts.newestVersionAt ?? facts.issueCreatedAt;
  if (now - hourlyFrom.getTime() >= HOURLY_MS) return "hourly";
  return null;
}

/** A removal was kept moments ago: this deletion streak already has its copy. */
function inRemovalStreak(facts: SaveFacts): boolean {
  return (
    facts.newestReason === "large-removal" &&
    facts.newestVersionAt !== null &&
    facts.now.getTime() - facts.newestVersionAt.getTime() < REMOVAL_STREAK_MS
  );
}

export function isLargeRemoval(
  before: ContentCounts,
  after: ContentCounts,
): boolean {
  if (before.pages - after.pages >= LARGE_REMOVAL_PAGES) return true;
  const removed = before.blocks - after.blocks;
  return (
    removed >= LARGE_REMOVAL_MIN_BLOCKS &&
    removed >= before.blocks * LARGE_REMOVAL_SHARE
  );
}

// ── The History routes' wire contract (shared with the editor) ──────────────

export const versionSummarySchema = z.object({
  id: z.string(),
  revision: z.number().int(),
  reason: z.enum(VERSION_REASONS),
  pageCount: z.number().int(),
  blockCount: z.number().int(),
  savedAt: z.string(),
});
export type VersionSummaryJson = z.infer<typeof versionSummarySchema>;

export const versionListSchema = z.object({
  versions: z.array(versionSummarySchema),
});

export const restoreRequestSchema = z
  .object({ baseRevision: z.number().int().min(0) })
  .strict();

export const restoreResultSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    revision: z.number().int(),
    unlinkedLogos: z.number().int(),
  }),
  z.object({
    ok: z.literal(false),
    reason: z.enum(["invalid", "conflict", "missing"]),
  }),
]);
export type RestoreResultJson = z.infer<typeof restoreResultSchema>;
