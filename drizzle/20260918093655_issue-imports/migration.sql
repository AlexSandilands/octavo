CREATE TYPE "issue_import_status" AS ENUM('started', 'committed', 'swept');--> statement-breakpoint
CREATE TABLE "issue_imports" (
	"id" text PRIMARY KEY,
	"admin_id" text,
	"status" "issue_import_status" DEFAULT 'started'::"issue_import_status" NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "issue_imports_status_created_at_idx" ON "issue_imports" ("status","created_at");--> statement-breakpoint
ALTER TABLE "issue_imports" ADD CONSTRAINT "issue_imports_admin_id_users_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE SET NULL;