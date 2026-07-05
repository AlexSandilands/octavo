import "server-only";
import { z } from "zod";
import { BRAND_IDS, DEFAULT_BRAND, type BrandId } from "./brands";
import { THEME_IDS } from "@/features/blocks/themes/registry";

// Server-only environment validation. The `server-only` import makes any
// accidental client-component import a build error — the parsed object holds
// secrets (R2 keys, AUTH_SECRET) that must never reach a browser bundle.
// Scripts that run outside Next (the seed, drizzle-kit) read process.env
// directly instead of importing this module.
//
// Validation is split in two so `next build` doesn't need runtime secrets as
// build args (issue #67). `next build` evaluates server modules, so anything
// validated *eagerly* at import must be present during the build — which is
// why Railway had to pass every secret as an ARG/ENV and BuildKit warned about
// it (SecretsUsedInArgOrEnv):
//
//   - BUILD-TIME vars (NEXT_PUBLIC_*): inlined into the bundle and genuinely
//     needed during `next build`. Non-secret, so validated eagerly at import —
//     a typo still fails the build loudly.
//   - RUNTIME vars (secrets + DATABASE_URL): validated lazily on first access
//     and memoized. The build never touches them (nothing on the build-eval
//     import graph reads a runtime field at module top level), so they no
//     longer need to be build args. The first access in production still
//     fail-fasts with the same clear message as before.
//
// R2 vars are optional in dev (local-disk fallback) but required in
// production: Railway's filesystem is ephemeral, so booting without durable
// storage would silently lose every uploaded image. Email vars are likewise
// optional in dev (magic links are logged to the console when EMAIL_API_KEY
// is unset) but required in production — a deploy that can't sign anyone in
// is broken even if it boots. AUTH_SECRET is required everywhere: Auth.js
// hard-fails without it at the first sign-in, so surface that at boot with a
// clear message instead.
const R2_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_URL",
] as const;

const EMAIL_KEYS = ["EMAIL_API_KEY", "EMAIL_FROM"] as const;

// Build-time vars: NEXT_PUBLIC_* branding, inlined at build. Non-secret and
// required during `next build`, so validated eagerly at import.
const buildSchema = z.object({
  // Deployment brand skin (issue #40) — the app-wide palette, build-time
  // inlined like the other NEXT_PUBLIC_* branding. An unknown value fails
  // here at boot rather than silently falling back to the default. The root
  // layout stamps this on <html data-brand>; brands.css does the rest.
  NEXT_PUBLIC_BRAND: z
    .enum(BRAND_IDS as unknown as [BrandId, ...BrandId[]])
    .default(DEFAULT_BRAND),
  // Which layout themes the editor picker + reader toggle offer (a comma list,
  // e.g. "classic,modern"; unset = all). Validated against the theme registry
  // so a typo fails loudly at boot; the registry filters the actual set.
  NEXT_PUBLIC_ISSUE_THEMES: z
    .string()
    .optional()
    .superRefine((value, ctx) => {
      if (!value) return;
      const known = new Set<string>(THEME_IDS);
      const unknown = value
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .filter((id) => !known.has(id));
      if (unknown.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            `unknown layout theme(s): ${unknown.join(", ")}. ` +
            `Known themes: ${THEME_IDS.join(", ")}`,
        });
      }
    }),
});

// Runtime vars: secrets + DATABASE_URL. Validated lazily (see below) so the
// build never needs them present.
const runtimeSchema = z
  .object({
    DATABASE_URL: z.string().min(1),

    AUTH_SECRET: z
      .string()
      .min(1, "missing — generate one with: npx auth secret"),
    // The canonical public origin, used to build absolute links in emails
    // (the new-issue magic link, the unsubscribe link) from server code that
    // has no incoming request to read a Host from. Optional: the publish
    // action falls back to the request's own Host when this is unset, so the
    // app boots and works without it.
    APP_URL: z.string().url().optional(),
    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET: z.string().optional(),
    R2_PUBLIC_URL: z.string().url().optional(),
    EMAIL_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
    // Sentry error reporting. Optional everywhere — the app boots and runs
    // fine with no DSN (Sentry.init is skipped, every capture is a no-op).
    // Server/edge runtimes read it from here; the browser reads the same value
    // from NEXT_PUBLIC_SENTRY_DSN (a DSN is a public ingest key, not a secret).
    SENTRY_DSN: z.string().url().optional(),
  })
  .superRefine((vars, ctx) => {
    if (process.env.NODE_ENV !== "production") return;
    const missingR2 = R2_KEYS.filter((key) => !vars[key]);
    if (missingR2.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "R2 storage is required in production (the local-disk fallback " +
          `would lose images on redeploy). Missing: ${missingR2.join(", ")}`,
      });
    }
    const missingEmail = EMAIL_KEYS.filter((key) => !vars[key]);
    if (missingEmail.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Email is required in production (members could not sign in " +
          `without it). Missing: ${missingEmail.join(", ")}`,
      });
    }
  });

type BuildEnv = z.infer<typeof buildSchema>;
type RuntimeEnv = z.infer<typeof runtimeSchema>;
type Env = BuildEnv & RuntimeEnv;

function parse<T>(schema: z.ZodType<T>, label: string): T {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    throw new Error(
      `Invalid ${label} environment:\n` +
        result.error.issues
          .map(
            (issue) =>
              `  - ${issue.path.join(".") || "(env)"}: ${issue.message}`,
          )
          .join("\n"),
    );
  }
  return result.data;
}

// Eager: fails the build (and boot) on a bad NEXT_PUBLIC_* value.
const buildEnv = parse(buildSchema, "build-time");
const buildKeys = new Set<string>(Object.keys(buildSchema.shape));

// Lazy + memoized: parsed on first access to a runtime field, so the build
// never triggers it. Preserves the fail-fast guarantee at runtime.
let runtimeEnvCache: RuntimeEnv | null = null;
function runtimeEnv(): RuntimeEnv {
  runtimeEnvCache ??= parse(runtimeSchema, "runtime");
  return runtimeEnvCache;
}

// A single `env` surface so call sites don't churn: build-time keys resolve
// eagerly, everything else defers to the memoized runtime parse on access.
export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string | symbol) {
    if (typeof prop === "string" && buildKeys.has(prop)) {
      return buildEnv[prop as keyof BuildEnv];
    }
    return runtimeEnv()[prop as keyof RuntimeEnv];
  },
}) as Env;
