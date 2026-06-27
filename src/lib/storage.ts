import "server-only";
import {
  deleteObject as deleteR2,
  isR2Configured,
  keyToUrl as r2KeyToUrl,
  putObject as putR2,
} from "./r2";
import {
  deleteLocalObject,
  localKeyToUrl,
  putLocalObject,
} from "./local-storage";

// Storage facade. Uses Cloudflare R2 when configured; otherwise falls back to a
// local filesystem backend so the image pipeline runs with no cloud setup in
// dev. The rest of the app calls these — never a specific backend.

const useR2 = isR2Configured();

// True when serving from the local filesystem (dev fallback). The upload route
// surfaces this so the admin knows uploads aren't going to durable storage.
export function usingLocalStorage(): boolean {
  return !useR2;
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  return useR2 ? putR2(key, body, contentType) : putLocalObject(key, body);
}

export async function deleteObject(key: string): Promise<void> {
  return useR2 ? deleteR2(key) : deleteLocalObject(key);
}

export function keyToUrl(key: string): string {
  return useR2 ? r2KeyToUrl(key) : localKeyToUrl(key);
}
