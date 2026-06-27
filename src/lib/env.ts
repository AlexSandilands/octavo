import { z } from "zod";

// Server-only environment validation. Import from server code (route handlers,
// server components, server actions) — never from client components.
const schema = z.object({
  APP_URL: z.string().url(),
  AUTH_SECRET: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
  R2_PUBLIC_URL: z.string().url(),
  EMAIL_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1),
});

export const env = schema.parse(process.env);
