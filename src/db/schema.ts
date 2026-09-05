import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  primaryKey,
  pgEnum,
  index,
  check,
} from "drizzle-orm/pg-core";
import { createId } from "@/lib/id";
import type { IssueContent } from "@/lib/blocks";
import { MARK_SIZE, TEXT_SIZE, type FooterAlign } from "@/lib/branding";

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
    // The club mark drawn in the running page footer (issue #97), chosen per
    // issue in the editor. Null = the text-only footer. Deleting a referenced
    // logo is refused (`countLogoReferences`), so set-null is only a backstop
    // for the one path that can still remove one: `logos.imageId` cascading
    // when its image row goes. A dangling id would render a broken mark on
    // every page, so the column empties instead.
    //
    // The explicit `AnyPgColumn` return type is drizzle's escape hatch for a
    // circular reference: issues → logos → images → issues (images.issueId), a
    // cycle TypeScript cannot infer its way around. Annotating the callback cuts
    // it; the foreign key itself is unaffected.
    logoId: text("logo_id").references((): AnyPgColumn => logos.id, {
      onDelete: "set null",
    }),
    // The footer sizes this issue's pages were laid out against (issue #128).
    // The running footer grows upward from the page's bottom margin, so a page
    // filled to its limit is overlapped if the global setting later grows
    // taller than it was authored for. Renderers clamp the live setting to
    // these (`settingsForIssue`), so a bigger footer reaches the issues with
    // room for it and waits on the rest until the author adopts it in the
    // editor — where the overflow marker catches whatever no longer fits.
    //
    // NOT NULL, in px (issue #216): the guard is only as good as its weakest
    // row, and an insert path that forgot these would otherwise be unclamped.
    // The default is the smallest preset so it fails safe (too short, never
    // too tall); createIssue and the seed supply the real values, and the #128
    // migration backfilled every row that predates the column from the
    // settings then in force.
    footerMarkSize: integer("footer_mark_size")
      .notNull()
      .default(MARK_SIZE.presets.small),
    footerTextSize: integer("footer_text_size")
      .notNull()
      .default(TEXT_SIZE.presets.small),
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

// Managed sponsors (content v2). A sponsor block in an issue references one of
// these by id rather than carrying its own name/href/logo, so the admin can
// update a sponsor once and have every placement follow. `logoId` reuses the
// images pipeline; onDelete set-null keeps the sponsor if its logo image is
// removed. `activeUntil` is an optional expiry the admin list flags — expiry is
// advisory only (it does not auto-remove the sponsor from published issues).
export const sponsors = pgTable("sponsors", {
  id: text("id").primaryKey().$defaultFn(createId),
  name: text("name").notNull(),
  href: text("href"),
  logoId: text("logo_id").references(() => images.id, {
    onDelete: "set null",
  }),
  activeUntil: timestamp("active_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// A small library of club logo marks (transparent PNG/WebP) the admin manages
// at /admin/magazine, so features can reference "a logo" by id instead of each one
// growing its own upload. `imageId` goes through the same images pipeline as
// everything else; it is notNull because a logo *is* its mark — a nameless-image
// row would be unrenderable — and cascades, so removing the underlying image
// (only the seed wipe does) takes the logo with it rather than leaving a
// dangling one. Accessed via src/server/logos.ts.
export const logos = pgTable(
  "logos",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    name: text("name").notNull(),
    imageId: text("image_id")
      .notNull()
      .references(() => images.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("logos_image_id_idx").on(t.imageId)],
);

// ── Magazine settings (issue #105) ──────────────────────────────────────────

// The one row of owner-editable branding: the magazine's wording and the
// running footer's appearance, edited at /admin/magazine. A singleton by
// construction — `id` is fixed at 1 by the CHECK, so the row is upserted rather
// than created/listed and there is no way to end up with two competing rows.
//
// EVERY value column is nullable and NULL means "use the deployment default"
// (the NEXT_PUBLIC_* branding vars / the shipped footer look, see
// src/lib/site-defaults.ts + DEFAULT_FOOTER_STYLE). That is what lets a
// deployment that never opens the page — and a database with no row at all —
// render exactly as it did before this table existed: there are no column
// defaults to disagree with the env, and clearing a field in the admin puts the
// deployment value back rather than blanking the site.
//
// The appearance columns are validated in the app (zod against the ranges and
// unions in src/lib/branding.ts), not by the database: the two sizes are plain
// integers in px (issue #216 — held to MARK_SIZE / TEXT_SIZE on read and on
// save) and the alignment is plain text rather than a pgEnum, because the set
// is presentational and expected to grow, and adding a value to a Postgres enum
// is a migration this app doesn't need to pay for.
export const settings = pgTable(
  "settings",
  {
    id: integer("id").primaryKey().default(1),
    magazineName: text("magazine_name"),
    orgName: text("org_name"),
    tagline: text("tagline"),
    footerMarkSize: integer("footer_mark_size"),
    footerTextSize: integer("footer_text_size"),
    footerAlign: text("footer_align").$type<FooterAlign>(),
    // Whether members are offered the PDF download (issue #162). Nullable like
    // every column above it — NULL is "not configured", which resolves to the
    // shipped default (enabled), so a deployment that never opens the page keeps
    // the downloads it has always had. A `default true` here would say the same
    // thing in the wrong place and break the table's one rule.
    pdfDownloads: boolean("pdf_downloads_enabled"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [check("settings_singleton", sql`${t.id} = 1`)],
);
