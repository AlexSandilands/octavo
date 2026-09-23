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
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { createId } from "@/lib/id";
import type { IssueContent } from "@/lib/blocks";
import {
  MARK_SIZE,
  TEXT_SIZE,
  type FooterAlign,
  type RemovedMemberComments,
} from "@/lib/branding";
import type {
  CommentDeletedBy,
  NameRetiredBy,
  ReportReason,
  ReportStatus,
} from "@/lib/comments";
import type { ImportResult } from "@/lib/issue-transfer/result";

// All timestamps are timestamptz: the app runs in a different timezone locally
// than on Railway, and naive timestamps make publishedAt comparisons drift.

// ── Auth.js tables (magic-link / email provider) ────────────────────────────
// `users` doubles as the club member record (see is_admin, subscribed). `name`
// is the admin's record of the member, never a posting name (`member_names`).

export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(createId),
  name: text("name"),
  email: text("email").notNull().unique(),
  notes: text("notes"),
  emailVerified: timestamp("email_verified", {
    mode: "date",
    withTimezone: true,
  }),
  isAdmin: boolean("is_admin").notNull().default(false),
  subscribed: boolean("subscribed").notNull().default(true),
  // Opt-in reply emails (issue #299). `subscribed` keeps meaning issue emails.
  replyEmails: boolean("reply_emails").notNull().default(false),
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
// No column default for `content`: every insert must supply a document that
// satisfies the cover-first invariant.
export const issues = pgTable(
  "issues",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    // The public address (/read/14), nullable and meaningful only once the issue
    // is published (issue #270) — a draft has none. The partial unique index and
    // the check constraint below are what enforce that.
    number: integer("number"),
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
    // NOT NULL, in px (issue #216): an insert path that forgot these would
    // otherwise be unclamped. The default is the smallest preset so it fails
    // safe; createIssue and the seed supply the real values.
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
  (t) => [
    // Kept: it orders the published lists' scan, which the partial unique index
    // below cannot — its predicate is not part of the key.
    index("issues_status_number_idx").on(t.status, t.number),
    uniqueIndex("issues_published_number_idx")
      .on(t.number)
      .where(sql`${t.status} = 'published'`),
    check(
      "issues_published_has_number",
      sql`${t.status} <> 'published' or ${t.number} is not null`,
    ),
  ],
);

// Every stored image, whoever owns it. `issueId` records the issue an editor
// upload was made under; sponsor logos, library marks and member avatars
// (`member_names.avatarImageId`) leave it null. What keeps an image alive is
// the reference scan in src/server/asset-cleanup.ts, never this column.
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

// ── Issue transfer (issue #293) ─────────────────────────────────────────────

export const issueImportStatus = pgEnum("issue_import_status", [
  "started",
  "committed",
  "swept",
]);

// One attempt to import a bundle (docs/issue-transfer.md). `set null` keeps the
// record, and the knowledge that `imports/<id>/` needs sweeping, past a removed
// admin.
export const issueImports = pgTable(
  "issue_imports",
  {
    id: text("id").primaryKey(),
    adminId: text("admin_id").references(() => users.id, {
      onDelete: "set null",
    }),
    status: issueImportStatus("status").notNull().default("started"),
    result: jsonb("result").$type<ImportResult>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("issue_imports_status_created_at_idx").on(t.status, t.createdAt),
  ],
);

// ── Discussion (issue #298) ─────────────────────────────────────────────────

// The names an account posts under (issue #299). One account may be a
// household, so it holds up to five unretired names (module-enforced); two
// accounts may share a name, one account may not hold it twice — `nameKey` is
// the normalised form (src/lib/member-name.ts) the unique index compares.
// `badge` is honoured only while the owner is an admin (joined at read time).
// A name with comments is retired rather than deleted, so they keep it.
// `retiredBy` says who retired it (`member` | `admin`, app-validated): the
// member may add their own retired name again, never one an admin retired.
export const memberNames = pgTable(
  "member_names",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    nameKey: text("name_key").notNull(),
    avatarImageId: text("avatar_image_id").references(() => images.id, {
      onDelete: "set null",
    }),
    badge: boolean("badge").notNull().default(false),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    retiredBy: text("retired_by").$type<NameRetiredBy>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("member_names_user_id_name_key_idx").on(t.userId, t.nameKey),
    index("member_names_name_key_idx").on(t.nameKey),
    index("member_names_user_id_idx").on(t.userId),
  ],
);

// One thread per issue: top-level comments and one level of replies (the
// module refuses a reply to a reply). A null author is a removed member,
// rendered "Former member". Hidden and deleted rows stay while they have
// replies, as a stub; a soft delete blanks `body` and records in `deletedBy`
// whether the author or an admin did it (app-validated, as `reason` is).
// `pageId` is the authored page's stable id, not its number, so renumbering
// never moves a tag.
export const comments = pgTable(
  "comments",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    issueId: text("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    authorNameId: text("author_name_id").references(() => memberNames.id, {
      onDelete: "set null",
    }),
    parentId: text("parent_id").references((): AnyPgColumn => comments.id, {
      onDelete: "cascade",
    }),
    body: text("body").notNull(),
    pageId: text("page_id"),
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: text("deleted_by").$type<CommentDeletedBy>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
  },
  (t) => [
    index("comments_issue_id_created_at_idx").on(t.issueId, t.createdAt),
    index("comments_parent_id_idx").on(t.parentId),
    index("comments_author_id_idx").on(t.authorId),
    index("comments_author_name_id_idx").on(t.authorNameId),
  ],
);

// A member's report of a comment. It outlives the comment (`set null`) and
// snapshots it as reported, so an edit or delete by its author can't erase the
// evidence. `reason` and `status` are app-validated text, as in `settings`.
export const commentReports = pgTable(
  "comment_reports",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    commentId: text("comment_id").references(() => comments.id, {
      onDelete: "set null",
    }),
    issueId: text("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    reporterId: text("reporter_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reason: text("reason").$type<ReportReason>().notNull(),
    note: text("note"),
    status: text("status").$type<ReportStatus>().notNull().default("open"),
    resolvedBy: text("resolved_by").references(() => users.id, {
      onDelete: "set null",
    }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    snapshotBody: text("snapshot_body").notNull(),
    snapshotName: text("snapshot_name"),
    snapshotAuthorId: text("snapshot_author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    snapshotCreatedAt: timestamp("snapshot_created_at", { withTimezone: true }),
    snapshotEditedAt: timestamp("snapshot_edited_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("comment_reports_comment_id_reporter_id_idx").on(
      t.commentId,
      t.reporterId,
    ),
    index("comment_reports_status_created_at_idx").on(t.status, t.createdAt),
  ],
);

// A reply to one of your comments. The module keeps the newest 100 per
// recipient, trimmed on insert.
export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    commentId: text("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("notifications_user_id_read_at_created_at_idx").on(
      t.userId,
      t.readAt,
      t.createdAt,
    ),
  ],
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
// The appearance columns are validated in the app (zod against
// src/lib/branding.ts), not the database: the sizes are px integers and the
// alignment plain text rather than a pgEnum, since the set is presentational
// and adding an enum value is a migration this app doesn't need to pay for.
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
    // Whether a theme may draw its textual running head — the magazine name and
    // issue number above the page content (issue #269). Nullable like every
    // column here, so an untouched deployment resolves to the shipped default
    // (shown).
    showRunningHead: boolean("show_running_head"),
    // Whether members are offered the PDF download (issue #162). Nullable like
    // every column above it — NULL is "not configured", which resolves to the
    // shipped default (enabled), so a deployment that never opens the page keeps
    // the downloads it has always had. A `default true` here would say the same
    // thing in the wrong place and break the table's one rule.
    pdfDownloads: boolean("pdf_downloads_enabled"),
    // The discussion switch and the removed-member policy (issue #299), same
    // rule: NULL is the shipped default — off, and anonymise.
    commentsEnabled: boolean("comments_enabled"),
    removedMemberComments: text(
      "removed_member_comments",
    ).$type<RemovedMemberComments>(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [check("settings_singleton", sql`${t.id} = 1`)],
);
