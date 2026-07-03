import "server-only";
import { z } from "zod";

// Server-only environment validation. The `server-only` import makes any
// accidental client-component import a build error — the parsed object holds
// secrets (R2 keys, AUTH_SECRET) that must never reach a browser bundle.
// Scripts that run outside Next (the seed, drizzle-kit) read process.env
// directly instead of importing this module.
//
// Auth / email vars are optional for now and become required as those phases
// land (see docs/ROADMAP.md). R2 vars are optional in dev (local-disk fallback)
// but required in production: Railway's filesystem is ephemeral, so booting
// without durable storage would silently lose every uploaded image.
const R2_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_URL",
] as const;

const schema = z
  .object({
    DATABASE_URL: z.string().min(1),

    AUTH_SECRET: z.string().optional(),
    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET: z.string().optional(),
    R2_PUBLIC_URL: z.string().url().optional(),
    EMAIL_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
  })
  .superRefine((vars, ctx) => {
    if (process.env.NODE_ENV !== "production") return;
    const missing = R2_KEYS.filter((key) => !vars[key]);
    if (missing.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "R2 storage is required in production (the local-disk fallback " +
          `would lose images on redeploy). Missing: ${missing.join(", ")}`,
      });
    }
  });

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(
    "Invalid environment:\n" +
      parsed.error.issues
        .map((issue) => `  - ${issue.path.join(".") || "(env)"}: ${issue.message}`)
        .join("\n"),
  );
}

export const env = parsed.data;
