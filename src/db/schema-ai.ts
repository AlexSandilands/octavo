import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createId } from "@/lib/id";
import { issues, users } from "./schema";

// AI assistant spend (issue #307), beside schema.ts to keep that file in bounds;
// drizzle.config.ts reads both.

// One row per model request. Both references outlive their rows (`set null`):
// a removed member's or deleted issue's spend still counts against the month.
// Input is split as the provider bills it — uncached, cache read, cache write —
// since cached reads dwarf uncached input and cost a tenth as much.
export const aiUsage = pgTable(
  "ai_usage",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    issueId: text("issue_id").references(() => issues.id, {
      onDelete: "set null",
    }),
    // One per author message; a run makes several requests.
    runId: text("run_id").notNull(),
    model: text("model").notNull(),
    provider: text("provider").notNull(),
    promptTokens: integer("prompt_tokens").notNull(),
    cacheReadTokens: integer("cache_read_tokens").notNull(),
    cacheWriteTokens: integer("cache_write_tokens").notNull(),
    completionTokens: integer("completion_tokens").notNull(),
    costUsd: numeric("cost_usd", {
      precision: 10,
      scale: 6,
      mode: "number",
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("ai_usage_created_at_idx").on(t.createdAt),
    index("ai_usage_run_id_idx").on(t.runId),
  ],
);

// The owner's one-off top-ups, made outside the app with `npm run ai:grant`.
// Each counts in the calendar month (UTC) it was made.
export const aiGrants = pgTable(
  "ai_grants",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    amountUsd: numeric("amount_usd", {
      precision: 10,
      scale: 2,
      mode: "number",
    }).notNull(),
    note: text("note").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("ai_grants_created_at_idx").on(t.createdAt),
    check("ai_grants_amount_positive", sql`${t.amountUsd} > 0`),
    check("ai_grants_note_length", sql`char_length(${t.note}) <= 200`),
  ],
);
