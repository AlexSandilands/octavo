import "server-only";
import {
  deleteObject as deleteR2,
  getObject as getR2,
  isR2Configured,
  keyToUrl as r2KeyToUrl,
  listKeys as listR2Keys,
  putObject as putR2,
} from "./r2";
import {
  deleteLocalObject,
  listLocalKeys,
  localKeyToUrl,
  putLocalObject,
  readLocalObject,
} from "./local-storage";

// Storage facade. Uses Cloudflare R2 when configured; otherwise falls back to a
// local filesystem backend so the image pipeline runs with no cloud setup in
// dev. The rest of the app calls these — never a specific backend.

// Resolved at call time, never at import: isR2Configured() reads the runtime
// R2_* env, and `next build` evaluates this module while collecting page data —
// computing it eagerly would force the R2 secrets to be build args (issue #67).
// No local cache needed: env.ts memoizes the runtime parse, so isR2Configured()
// is a handful of property reads over a frozen snapshot.

// True when serving from the local filesystem (dev fallback). The upload route
// surfaces this so the admin knows uploads aren't going to durable storage.
export function usingLocalStorage(): boolean {
  return !isR2Configured();
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  return isR2Configured()
    ? putR2(key, body, contentType)
    : putLocalObject(key, body);
}

export async function deleteObject(key: string): Promise<void> {
  return isR2Configured() ? deleteR2(key) : deleteLocalObject(key);
}

// Prefix operations are the only storage calls whose blast radius isn't one
// named object, so they take a *folder* and nothing else: non-empty, relative,
// no traversal, and ending in "/" — which is what stops a caller from passing
// "" (the whole bucket) or an accidental "pdfs" that would also sweep "pdfs-v2/".
// Enforced here rather than in each backend so both obey the same rule.
function requireFolderPrefix(prefix: string): string {
  const ok =
    prefix.length > 0 &&
    prefix.endsWith("/") &&
    !prefix.startsWith("/") &&
    !prefix.split("/").includes("..");
  if (!ok) throw new Error(`Unsafe storage prefix: ${JSON.stringify(prefix)}`);
  return prefix;
}

// Every key stored under a folder prefix.
export async function listKeys(prefix: string): Promise<string[]> {
  requireFolderPrefix(prefix);
  return isR2Configured() ? listR2Keys(prefix) : listLocalKeys(prefix);
}

// Delete everything under a folder prefix, returning how many objects went.
// Used for derived artefacts the database doesn't name key by key — the cached
// PDFs of a deleted issue. Never for images: those are deleted by the exact keys
// their rows carry, because an image's key prefix says which issue *uploaded* it,
// not which issues still show it.
export async function deleteByPrefix(prefix: string): Promise<number> {
  const keys = await listKeys(prefix);
  for (const key of keys) await deleteObject(key);
  return keys.length;
}

// Read stored bytes, or null when the key isn't present. Backs the cached-PDF
// lookup: a hit serves the bytes, a miss triggers generation.
export async function getObject(key: string): Promise<Buffer | null> {
  return isR2Configured() ? getR2(key) : readLocalObject(key);
}

export function keyToUrl(key: string): string {
  return isR2Configured() ? r2KeyToUrl(key) : localKeyToUrl(key);
}
