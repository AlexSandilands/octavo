import "server-only";

// A whole-club selection is thousands of ids, and Postgres binds one parameter
// per id in an `IN` list against a hard ceiling of 65,535 per statement — so
// the bulk writes send their ids to the database a chunk at a time. The chunks
// are a statement-level detail only: they all run inside the one transaction
// that took the guard-rail locks, so the operation stays atomic and the
// invariants are decided once for the whole selection, never per chunk.
const ID_CHUNK = 1000;

export function chunked<T>(items: T[]): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += ID_CHUNK) {
    batches.push(items.slice(i, i + ID_CHUNK));
  }
  return batches;
}
