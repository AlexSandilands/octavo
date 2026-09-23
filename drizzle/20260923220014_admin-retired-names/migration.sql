ALTER TABLE "member_names" ADD COLUMN "retired_by" text;--> statement-breakpoint
-- Names retired before this column existed stay re-addable, as they were.
UPDATE "member_names" SET "retired_by" = 'member' WHERE "retired_at" IS NOT NULL;
