-- Footer sizes become whole px (issue #216). The three-step names map to the
-- exact pixel values they always rendered at — mark 18/27/36, type 9/10/12 —
-- so every existing row renders byte-identically after this. The backfill is
-- the USING clause of the type change itself: no deploy window ever sees a
-- text value in an integer column or a name the app no longer knows.
--
-- The old text defaults are dropped first because Postgres would otherwise try
-- to cast 'medium' to integer for the default expression (USING does not apply
-- to defaults). The new issues default is the smallest preset — the reserve
-- fails safe, too short rather than too tall — and an unrecognised issue value
-- becomes the old default (medium), which is what that row rendered as.
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
-- The settings columns stay nullable: NULL is "use the deployment default", and
-- an unrecognised name becomes NULL for the same reason the app's read path
-- degrades one to the default.
ALTER TABLE "settings" ALTER COLUMN "footer_mark_size" SET DATA TYPE integer USING (
  CASE "footer_mark_size" WHEN 'small' THEN 18 WHEN 'medium' THEN 27 WHEN 'large' THEN 36 ELSE NULL END
);--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "footer_text_size" SET DATA TYPE integer USING (
  CASE "footer_text_size" WHEN 'small' THEN 9 WHEN 'medium' THEN 10 WHEN 'large' THEN 12 ELSE NULL END
);
