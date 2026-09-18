import "server-only";
import * as Sentry from "@sentry/nextjs";

// Capture, never throw. An import that has already failed has a readable
// refusal to return and objects to clean up; a reporter that throws on the way
// out would turn that into a 500 and skip the cleanup — the same rule the
// post-delete sweep follows (server/asset-cleanup.ts).
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
