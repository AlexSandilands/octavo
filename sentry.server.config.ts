// Sentry initialisation for the Node.js server runtime (route handlers, server
// actions, RSC data access). Loaded once at boot by src/instrumentation.ts.
//
// Error reporting only — no performance tracing (tracesSampleRate: 0), no
// session replay, no profiling. This is a free-tier safety net that tells the
// "landlord" developer when something breaks, not an APM.
//
// The DSN is optional (see src/lib/env.ts): with no SENTRY_DSN set, init is
// skipped and every Sentry.captureException call downstream is a silent no-op,
// so the app boots and runs identically without a Sentry account.
import * as Sentry from "@sentry/nextjs";
import { env } from "@/lib/env";

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    tracesSampleRate: 0,
    // Don't attach IP addresses / cookies / request bodies by default. Member
    // emails and other PII are only added deliberately, per event, where a
    // diagnosis needs them (see the upload route / publish blast capture
    // sites) — never blanket-collected.
    sendDefaultPii: false,
    enableLogs: false,
  });
}
