CREATE TABLE "issue_versions" (
	"id" text PRIMARY KEY,
	"issue_id" text NOT NULL,
	"content" jsonb NOT NULL,
	"revision" integer NOT NULL,
	"reason" text NOT NULL,
	"page_count" integer NOT NULL,
	"block_count" integer NOT NULL,
	"saved_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "issue_versions_issue_revision_idx" ON "issue_versions" ("issue_id","revision");--> statement-breakpoint
ALTER TABLE "issue_versions" ADD CONSTRAINT "issue_versions_issue_id_issues_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE;