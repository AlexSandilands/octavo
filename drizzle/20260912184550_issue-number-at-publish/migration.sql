ALTER TABLE "issues" DROP CONSTRAINT "issues_number_key";--> statement-breakpoint
ALTER TABLE "issues" ALTER COLUMN "number" DROP NOT NULL;--> statement-breakpoint
--> Drafts have no number from here on (issue #270): the number is chosen in the
--> publish modal. Existing drafts are nulled rather than left holding a stale
--> one the publish proposal would then contradict. Published rows are untouched.
UPDATE "issues" SET "number" = NULL WHERE "status" = 'draft';--> statement-breakpoint
CREATE UNIQUE INDEX "issues_published_number_idx" ON "issues" ("number") WHERE "status" = 'published';--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_published_has_number" CHECK ("status" <> 'published' or "number" is not null);
