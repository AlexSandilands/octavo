// The one detector for "Playwright couldn't launch Chromium because the
// browser isn't installed", shared by the magazine PDF generator (pdf.ts,
// server-only) and the local invoice tool (scripts/invoice/generate.mts,
// which must NOT import server-only modules) — so a future Playwright
// rewording is fixed in one place. Deliberately framework-free.

// Chromium isn't installed on the build machine or in a bare container.
// Surface that as its own error so the caller can report it clearly (and the
// operator knows to run `npx playwright install --with-deps chromium`) rather
// than bury it in a generic failure. The original launch error rides along in
// the message as well as `cause`: "install Chromium" is only the right advice
// when the browser is truly missing, and if the detector ever misfires (e.g.
// missing system libraries), the real cause must stay visible.
export class ChromiumUnavailableError extends Error {
  constructor(cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(
      "Headless Chromium is not available. Install it with: " +
        `npx playwright install --with-deps chromium\n(launch failed with: ${detail})`,
    );
    this.name = "ChromiumUnavailableError";
    this.cause = cause;
  }
}

export function isMissingBrowser(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("Executable doesn't exist") ||
    msg.includes("playwright install") ||
    msg.includes("Failed to launch")
  );
}
