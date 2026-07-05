import "server-only";
import {
  deleteObject as deleteR2,
  getObject as getR2,
  isR2Configured,
  keyToUrl as r2KeyToUrl,
  putObject as putR2,
} from "./r2";
import {
  deleteLocalObject,
  localKeyToUrl,
  putLocalObject,
  readLocalObject,
} from "./local-storage";

// Storage facade. Uses Cloudflare R2 when configured; otherwise falls back to a
// local filesystem backend so the image pipeline runs with no cloud setup in
// dev. The rest of the app calls these — never a specific backend.

// Resolved lazily on first use, not at import: isR2Configured() reads the
// runtime R2_* env, and `next build` evaluates this module while collecting
// page data — computing it eagerly would force the R2 secrets to be build
// args (issue #67). The choice is stable per process, so memoize it.
let r2EnabledCache: boolean | null = null;
function r2Enabled(): boolean {
  r2EnabledCache ??= isR2Configured();
  return r2EnabledCache;
}

// True when serving from the local filesystem (dev fallback). The upload route
// surfaces this so the admin knows uploads aren't going to durable storage.
export function usingLocalStorage(): boolean {
  return !r2Enabled();
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  return r2Enabled()
    ? putR2(key, body, contentType)
    : putLocalObject(key, body);
}

export async function deleteObject(key: string): Promise<void> {
  return r2Enabled() ? deleteR2(key) : deleteLocalObject(key);
}

// Read stored bytes, or null when the key isn't present. Backs the cached-PDF
// lookup: a hit serves the bytes, a miss triggers generation.
export async function getObject(key: string): Promise<Buffer | null> {
  return r2Enabled() ? getR2(key) : readLocalObject(key);
}

export function keyToUrl(key: string): string {
  return r2Enabled() ? r2KeyToUrl(key) : localKeyToUrl(key);
}
