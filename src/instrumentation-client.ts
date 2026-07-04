// Sentry initialisation for the browser. Next loads this on the client the way
// it loads instrumentation.ts on the server (supported since Next 15.3). It
// reports client-side React render errors surfaced by the error boundaries
// (app/global-error.tsx, app/error.tsx, app/admin/error.tsx) and any explicit
// Sentry.captureException from client components (e.g. the editor's autosave /
// publish handlers).
//
// The DSN here MUST be a NEXT_PUBLIC_ var: this file is bundled for the browser
// and cannot import the server-only src/lib/env.ts. A Sentry DSN is a public
// ingest key by design (safe to ship to the client) — set NEXT_PUBLIC_SENTRY_DSN
// to the same value as SENTRY_DSN. With neither set, init is skipped and every
// capture call is a no-op, so the app runs identically without Sentry.
//
// Client events are sent directly to the Sentry ingest host; src/middleware.ts
// adds that host to the CSP `connect-src` so the strict nonce CSP doesn't block
// them (it derives the host from the DSN — see buildCsp there).
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    enableLogs: false,
  });
}

// Lets Sentry tie a browser navigation to any server error on the same route.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
