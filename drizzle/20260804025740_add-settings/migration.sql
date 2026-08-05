CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1,
	"magazine_name" text,
	"org_name" text,
	"tagline" text,
	"footer_mark_size" text,
	"footer_text_size" text,
	"footer_align" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_singleton" CHECK ("id" = 1)
);
