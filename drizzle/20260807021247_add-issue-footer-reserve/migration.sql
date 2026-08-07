ALTER TABLE "issues" ADD COLUMN "footer_mark_size" text DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "footer_text_size" text DEFAULT 'medium' NOT NULL;--> statement-breakpoint
-- Backfill (issue #128). Every issue that predates these columns was laid out
-- against whatever the footer settings say right now — that is what its pages
-- currently render with, and they render without overlap — so those values are
-- its reserve. Without this an owner who had already chosen a taller footer
-- would see every existing issue clamped back to the shipped default.
--
-- A NULL column on the settings row (and the no-row case) both mean "use the
-- deployment default", which for the footer's appearance is the code constant
-- 'medium' — the same value the column defaults to.
UPDATE "issues" SET
  "footer_mark_size" = COALESCE((SELECT "footer_mark_size" FROM "settings" WHERE "id" = 1), 'medium'),
  "footer_text_size" = COALESCE((SELECT "footer_text_size" FROM "settings" WHERE "id" = 1), 'medium');
