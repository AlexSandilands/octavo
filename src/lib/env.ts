import { z } from "zod";

// Server-only environment validation. Import from server code (route handlers,
// server components, server actions) — never from client components.
//
// Phase 1 only needs the database. Auth / R2 / email vars are optional for now
// and become required as those phases land (see docs/IMPLEMENTATION_PLAN.md).
const schema = z.object({
  DATABASE_URL: z.string().min(1),

  AUTH_SECRET: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_URL: z.string().url().optional(),
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
});

export const env = schema.parse(process.env);
