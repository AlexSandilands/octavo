// Stable id generator for primary keys. Uses the Web Crypto API available in
// both Node (18+) and edge runtimes.
export function createId(): string {
  return crypto.randomUUID();
}
