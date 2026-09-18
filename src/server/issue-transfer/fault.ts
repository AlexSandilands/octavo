import "server-only";

// Test-only failure injection: the gate has to fail an import in places no
// valid request can. Driven by ISSUE_TRANSFER_FAULT (a comma list) on the
// server process, and ignored outside development.

export type FaultPoint = "objects" | "transaction" | "post-commit" | "cleanup";

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
