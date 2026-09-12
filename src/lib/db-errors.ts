// True for Postgres unique-constraint violations (SQLSTATE 23505). drizzle 1.0
// wraps driver errors in a DrizzleQueryError, so the SQLSTATE lives on `.cause`;
// walk a few levels of the chain rather than only the top-level error.
export function isUniqueViolation(err: unknown): boolean {
  let e: unknown = err;
  for (let depth = 0; e != null && depth < 4; depth++) {
    if (
      typeof e === "object" &&
      "code" in e &&
      (e as { code?: unknown }).code === "23505"
    ) {
      return true;
    }
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}
