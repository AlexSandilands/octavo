CREATE TABLE "sponsors" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"href" text,
	"logo_id" text,
	"active_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sponsors" ADD CONSTRAINT "sponsors_logo_id_images_id_fkey" FOREIGN KEY ("logo_id") REFERENCES "images"("id") ON DELETE SET NULL;