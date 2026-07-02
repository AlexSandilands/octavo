import "server-only";
import { z } from "zod";

// Server-only environment validation. The `server-only` import makes any
// accidental client-component import a build error — the parsed object holds
// secrets (R2 keys, AUTH_SECRET) that must never reach a browser bundle.
// Scripts that run outside Next (the seed, drizzle-kit) read process.env
// directly instead of importing this module.
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
