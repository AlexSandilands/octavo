import * as Sentry from "@sentry/nextjs";

// A thrown editor action (network drop, server 500) shows the admin only the
// status pill — report it so lost-work risks are visible beyond the console.
export function reportEditorError(
  error: unknown,
  action: "save" | "publish",
  extra: Record<string, unknown>,
) {
  console.error(`Editor ${action} failed`, extra, error);
  Sentry.captureException(error, {
    tags: { feature: "editor", action },
    extra,
  });
}
