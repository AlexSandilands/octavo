CREATE TABLE "comment_reports" (
	"id" text PRIMARY KEY,
	"comment_id" text,
	"issue_id" text NOT NULL,
	"reporter_id" text,
	"reason" text NOT NULL,
	"note" text,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"snapshot_body" text NOT NULL,
	"snapshot_name" text,
	"snapshot_author_id" text,
	"snapshot_created_at" timestamp with time zone,
	"snapshot_edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" text PRIMARY KEY,
	"issue_id" text NOT NULL,
	"author_id" text,
	"author_name_id" text,
	"parent_id" text,
	"body" text NOT NULL,
	"page_id" text,
	"hidden_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "member_names" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"avatar_image_id" text,
	"badge" boolean DEFAULT false NOT NULL,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"comment_id" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "comments_enabled" boolean;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "removed_member_comments" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reply_emails" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "comment_reports_comment_id_reporter_id_idx" ON "comment_reports" ("comment_id","reporter_id");--> statement-breakpoint
CREATE INDEX "comment_reports_status_created_at_idx" ON "comment_reports" ("status","created_at");--> statement-breakpoint
CREATE INDEX "comments_issue_id_created_at_idx" ON "comments" ("issue_id","created_at");--> statement-breakpoint
CREATE INDEX "comments_parent_id_idx" ON "comments" ("parent_id");--> statement-breakpoint
CREATE INDEX "comments_author_id_idx" ON "comments" ("author_id");--> statement-breakpoint
CREATE INDEX "comments_author_name_id_idx" ON "comments" ("author_name_id");--> statement-breakpoint
CREATE UNIQUE INDEX "member_names_user_id_name_key_idx" ON "member_names" ("user_id","name_key");--> statement-breakpoint
CREATE INDEX "member_names_name_key_idx" ON "member_names" ("name_key");--> statement-breakpoint
CREATE INDEX "member_names_user_id_idx" ON "member_names" ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications" ("user_id","read_at","created_at");--> statement-breakpoint
ALTER TABLE "comment_reports" ADD CONSTRAINT "comment_reports_comment_id_comments_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "comment_reports" ADD CONSTRAINT "comment_reports_issue_id_issues_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "comment_reports" ADD CONSTRAINT "comment_reports_reporter_id_users_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "comment_reports" ADD CONSTRAINT "comment_reports_resolved_by_users_id_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "comment_reports" ADD CONSTRAINT "comment_reports_snapshot_author_id_users_id_fkey" FOREIGN KEY ("snapshot_author_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_issue_id_issues_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_name_id_member_names_id_fkey" FOREIGN KEY ("author_name_id") REFERENCES "member_names"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_comments_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "member_names" ADD CONSTRAINT "member_names_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "member_names" ADD CONSTRAINT "member_names_avatar_image_id_images_id_fkey" FOREIGN KEY ("avatar_image_id") REFERENCES "images"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_comment_id_comments_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE;