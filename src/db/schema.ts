import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  primaryKey,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { createId } from "@/lib/id";
import type { IssueContent } from "@/lib/blocks";

// All timestamps are timestamptz: the app runs in a different timezone locally
// than on Railway, and naive timestamps make publishedAt comparisons drift.

// ── Auth.js tables (magic-link / email provider) ────────────────────────────
// `users` doubles as the club member record (see is_admin, subscribed).

export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(createId),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", {
    mode: "date",
    withTimezone: true,
  }),
  isAdmin: boolean("is_admin").notNull().default(false),
  subscribed: boolean("subscribed").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    sessionToken: text("session_token").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// ── Magazine content ────────────────────────────────────────────────────────

export const issueStatus = pgEnum("issue_status", ["draft", "published"]);

// The whole pages→blocks tree lives in `content` as one JSONB document — the
// source of truth. Validated with zod at the edges (see src/lib/blocks.ts).
// `number` is the public address (/read/14), so it must be unique; it is
// allocated atomically in createIssue. No column default for `content`: every
// insert must supply a document that satisfies the cover-first invariant.
export const issues = pgTable(
  "issues",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    number: integer("number").notNull().unique(),
    title: text("title").notNull(),
    theme: text("theme").notNull().default("classic"),
    status: issueStatus("status").notNull().default("draft"),
    content: jsonb("content").$type<IssueContent>().notNull(),
    // Bumped on every content write; autosaves send the revision they were
    // based on so a stale editor can't silently overwrite a newer one.
    revision: integer("revision").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("issues_status_number_idx").on(t.status, t.number)],
);

export const images = pgTable(
  "images",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    key: text("key").notNull().unique(),
    width: integer("width"),
    height: integer("height"),
    issueId: text("issue_id").references(() => issues.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("images_issue_id_idx").on(t.issueId)],
);
