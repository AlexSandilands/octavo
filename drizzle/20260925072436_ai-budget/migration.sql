CREATE TABLE "ai_grants" (
	"id" text PRIMARY KEY,
	"amount_usd" numeric(10,2) NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_grants_amount_positive" CHECK ("amount_usd" > 0),
	CONSTRAINT "ai_grants_note_length" CHECK (char_length("note") <= 200)
);
--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" text PRIMARY KEY,
	"user_id" text,
	"issue_id" text,
	"run_id" text NOT NULL,
	"model" text NOT NULL,
	"provider" text NOT NULL,
	"prompt_tokens" integer NOT NULL,
	"cache_read_tokens" integer NOT NULL,
	"cache_write_tokens" integer NOT NULL,
	"completion_tokens" integer NOT NULL,
	"cost_usd" numeric(10,6) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ai_grants_created_at_idx" ON "ai_grants" ("created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_created_at_idx" ON "ai_usage" ("created_at");--> statement-breakpoint
CREATE INDEX "ai_usage_run_id_idx" ON "ai_usage" ("run_id");--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_issue_id_issues_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE SET NULL;