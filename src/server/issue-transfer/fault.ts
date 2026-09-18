import "server-only";

// Test-only failure injection for the import's cleanup path (the gate has to be
// able to fail an import *partway through the object writes*, which no valid
// request can do). It is driven by an environment variable the server process
// is started with — nothing in a request can reach it — and it is ignored
// outside development, so a production deployment has no seam at all.
//
// Set ISSUE_TRANSFER_FAULT to one or more of the names below (comma separated)
// when running the gate — the recovery case needs a failure *and* a cleanup
// that cannot complete.

export type FaultPoint = "objects" | "transaction" | "cleanup";

export class InjectedFaultError extends Error {
  constructor(point: FaultPoint) {
    super(`Injected issue-transfer fault: ${point}`);
  }
}

export function faultInjected(point: FaultPoint): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return (process.env.ISSUE_TRANSFER_FAULT ?? "").split(",").includes(point);
}

export function throwIfInjected(point: FaultPoint): void {
  if (faultInjected(point)) throw new InjectedFaultError(point);
}
