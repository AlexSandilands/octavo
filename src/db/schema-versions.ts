import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createId } from "@/lib/id";
import type { IssueContent } from "@/lib/blocks";
import type { VersionReason } from "@/lib/issue-versions";
import { issues } from "./schema";

// Draft version history (aboard #51), beside schema.ts to keep that file in
// bounds; drizzle.config.ts reads it too.

// An earlier copy of one issue's pages, kept by the save path just before it
// overwrote them (src/server/issues.ts). Pages only: title, theme and mark are
// not versioned. The newest KEEP_VERSIONS per issue survive; they go with the
// issue. `content` is stored as it was saved, in whatever content version that
// was, and parsed through issueContentSchema on the way back out.
export const issueVersions = pgTable(
  "issue_versions",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    issueId: text("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    content: jsonb("content").$type<IssueContent>().notNull(),
    // The issue's revision this content was saved at — at most one version each.
    revision: integer("revision").notNull(),
    reason: text("reason").$type<VersionReason>().notNull(),
    pageCount: integer("page_count").notNull(),
    blockCount: integer("block_count").notNull(),
    // When this content was last saved (the issue's updatedAt at the time).
    savedAt: timestamp("saved_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Revisions only grow, so this is also the newest-first order. And the
    // dedupe: the save path inserts ON CONFLICT DO NOTHING.
    uniqueIndex("issue_versions_issue_revision_idx").on(t.issueId, t.revision),
  ],
);
