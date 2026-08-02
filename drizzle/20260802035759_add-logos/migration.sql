CREATE TABLE "logos" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"image_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "logos_image_id_idx" ON "logos" ("image_id");--> statement-breakpoint
ALTER TABLE "logos" ADD CONSTRAINT "logos_image_id_images_id_fkey" FOREIGN KEY ("image_id") REFERENCES "images"("id") ON DELETE CASCADE;