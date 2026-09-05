-- Footer sizes become whole px (issue #216). The preset names map to the px
-- they always rendered at (mark 18/27/36, type 9/10/12), backfilled in the
-- USING clause so no deploy window sees a mixed column. Defaults are dropped
-- first because USING does not apply to them; the new issues default is the
-- smallest preset, which fails safe (too short, never too tall).
ALTER TABLE "issues" ALTER COLUMN "footer_mark_size" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "issues" ALTER COLUMN "footer_text_size" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "issues" ALTER COLUMN "footer_mark_size" SET DATA TYPE integer USING (
  CASE "footer_mark_size" WHEN 'small' THEN 18 WHEN 'large' THEN 36 ELSE 27 END
);--> statement-breakpoint
ALTER TABLE "issues" ALTER COLUMN "footer_text_size" SET DATA TYPE integer USING (
  CASE "footer_text_size" WHEN 'small' THEN 9 WHEN 'large' THEN 12 ELSE 10 END
);--> statement-breakpoint
ALTER TABLE "issues" ALTER COLUMN "footer_mark_size" SET DEFAULT 18;--> statement-breakpoint
ALTER TABLE "issues" ALTER COLUMN "footer_text_size" SET DEFAULT 9;--> statement-breakpoint
-- Settings stay nullable: NULL (or an unknown name) means "use the default".
ALTER TABLE "settings" ALTER COLUMN "footer_mark_size" SET DATA TYPE integer USING (
  CASE "footer_mark_size" WHEN 'small' THEN 18 WHEN 'medium' THEN 27 WHEN 'large' THEN 36 ELSE NULL END
);--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "footer_text_size" SET DATA TYPE integer USING (
  CASE "footer_text_size" WHEN 'small' THEN 9 WHEN 'medium' THEN 10 WHEN 'large' THEN 12 ELSE NULL END
);
