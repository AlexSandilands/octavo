// Next.js instrumentation hook. `register` runs once when the server process
// starts; Next calls it on both the Node.js and Edge runtimes, so we load the
// matching Sentry config for whichever this is. `onRequestError` is Next's hook
// for errors thrown while rendering Server Components / route handlers — routing
// it through Sentry.captureRequestError is what makes a thrown server-action or
// RSC error show up as an event with request context.
//
// Both are no-ops without a DSN (the config files skip Sentry.init), so this
// adds no behaviour when Sentry is unconfigured.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
    // Recovery for imports that died before they could clean up (issue #293).
    // Not awaited, so boot never waits on it. The import stays inside this
    // branch: that is what keeps node:fs out of the Edge bundle, and out of
    // `next build`'s evaluation of the database client (issue #67).
    void import("./server/issue-transfer/operations")
      .then(({ sweepAbandonedImports }) => sweepAbandonedImports())
      .catch((err) => {
        console.error(
          "Could not sweep abandoned issue imports at startup",
          err,
        );
      });
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
