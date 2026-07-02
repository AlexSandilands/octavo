ALTER TABLE "images" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "issues" ALTER COLUMN "content" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "issues" ALTER COLUMN "published_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "issues" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "issues" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sessions" ALTER COLUMN "expires" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email_verified" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "verification_tokens" ALTER COLUMN "expires" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "images_issue_id_idx" ON "images" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "issues_status_number_idx" ON "issues" USING btree ("status","number");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "issues" DROP COLUMN "cover_image_id";--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_key_unique" UNIQUE("key");--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_number_unique" UNIQUE("number");