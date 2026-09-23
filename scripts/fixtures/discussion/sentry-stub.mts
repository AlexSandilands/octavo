// Stand-in for @sentry/nextjs under the discussion checks: under tsx the real
// package's CommonJS build hides its functions behind `default`, so app code's
// `Sentry.captureException` would throw. This records the captures instead.
const state = globalThis as { __sentryCaptures?: unknown[] };
state.__sentryCaptures = [];

export function captureException(err: unknown) {
  state.__sentryCaptures!.push(err);
}

export function captureMessage(message: string) {
  state.__sentryCaptures!.push(message);
}

export function sentryCaptures(): unknown[] {
  return state.__sentryCaptures!;
}
