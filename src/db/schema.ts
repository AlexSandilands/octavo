import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  primaryKey,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createId } from "@/lib/id";

// ── Auth.js tables (magic-link / email provider) ────────────────────────────
// `users` doubles as the club member record (see is_admin, subscribed).

export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(createId),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  isAdmin: boolean("is_admin").notNull().default(false),
  subscribed: boolean("subscribed").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// ── Magazine content ────────────────────────────────────────────────────────

export const issueStatus = pgEnum("issue_status", ["draft", "published"]);

export const issues = pgTable("issues", {
  id: text("id").primaryKey().$defaultFn(createId),
  number: integer("number").notNull(),
  title: text("title").notNull(),
  theme: text("theme").notNull().default("classic"),
  status: issueStatus("status").notNull().default("draft"),
  coverImageId: text("cover_image_id"),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const pages = pgTable("pages", {
  id: text("id").primaryKey().$defaultFn(createId),
  issueId: text("issue_id")
    .notNull()
    .references(() => issues.id, { onDelete: "cascade" }),
  order: integer("order").notNull(),
});

// A block's `payload` shape depends on `type` (heading | text | image | sponsor).
// Validate payloads with zod at the edges; see docs/design-principles.md.
export const blocks = pgTable("blocks", {
  id: text("id").primaryKey().$defaultFn(createId),
  pageId: text("page_id")
    .notNull()
    .references(() => pages.id, { onDelete: "cascade" }),
  order: integer("order").notNull(),
  type: text("type").notNull(),
  payload: jsonb("payload").notNull(),
});

export const images = pgTable("images", {
  id: text("id").primaryKey().$defaultFn(createId),
  key: text("key").notNull(),
  width: integer("width"),
  height: integer("height"),
  issueId: text("issue_id").references(() => issues.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
