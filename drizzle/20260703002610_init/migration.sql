CREATE TYPE "issue_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "images" (
	"id" text PRIMARY KEY,
	"key" text NOT NULL UNIQUE,
	"width" integer,
	"height" integer,
	"issue_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" text PRIMARY KEY,
	"number" integer NOT NULL UNIQUE,
	"title" text NOT NULL,
	"theme" text DEFAULT 'classic' NOT NULL,
	"status" "issue_status" DEFAULT 'draft'::"issue_status" NOT NULL,
	"content" jsonb NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY,
	"user_id" text NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY,
	"name" text,
	"email" text NOT NULL UNIQUE,
	"email_verified" timestamp with time zone,
	"is_admin" boolean DEFAULT false NOT NULL,
	"subscribed" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text,
	"token" text,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_pkey" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE INDEX "images_issue_id_idx" ON "images" ("issue_id");--> statement-breakpoint
CREATE INDEX "issues_status_number_idx" ON "issues" ("status","number");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" ("user_id");--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_issue_id_issues_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;