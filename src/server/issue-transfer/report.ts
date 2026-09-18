import "server-only";
import * as Sentry from "@sentry/nextjs";

// Capture, never throw: a failing reporter must not turn a handled refusal into
// a 500 and skip the cleanup behind it (as in server/asset-cleanup.ts).
export function report(error: unknown, context: Record<string, unknown>): void {
  try {
    Sentry.captureException(error, {
      tags: { stage: "issue-transfer" },
      extra: context,
    });
  } catch (failure) {
    console.error("Could not report an issue-transfer failure", error, failure);
  }
}
