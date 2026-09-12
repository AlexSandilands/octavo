ALTER TABLE "issues" ADD COLUMN "display_number" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "issues_effective_display_number_idx" ON "issues" (coalesce("display_number", "number"));