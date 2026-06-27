import { defineConfig } from "drizzle-kit";

// drizzle-kit is a standalone CLI and doesn't load .env.local the way Next does.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Not present (e.g. CI/prod) — DATABASE_URL is expected in the environment.
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
