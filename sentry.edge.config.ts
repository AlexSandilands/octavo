// Sentry initialisation for the Edge runtime (middleware). Loaded once at boot
// by src/instrumentation.ts. Same minimal, error-only posture as the server
// config — see sentry.server.config.ts for the rationale. Optional DSN: a
// no-op when SENTRY_DSN is unset.
import * as Sentry from "@sentry/nextjs";
import { env } from "@/lib/env";

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    enableLogs: false,
  });
}
