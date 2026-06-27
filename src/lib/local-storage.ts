import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

// Dev-only object storage on the local filesystem, used when R2 isn't configured
// so the image pipeline is fully testable with zero cloud setup. Objects live
// under .data/uploads (gitignored) and are served by the /api/images route.
//
// Not for production — Railway's disk is ephemeral, so configure R2 there.

const ROOT = path.join(process.cwd(), ".data", "uploads");

// Resolve a key to an absolute path inside ROOT, refusing path traversal. Keys
// are app-generated, but the GET route derives one from the URL — so guard it.
function resolveSafe(key: string): string {
  const dest = path.resolve(ROOT, key);
  if (dest !== ROOT && !dest.startsWith(ROOT + path.sep)) {
    throw new Error("Invalid object key");
  }
  return dest;
}

export async function putLocalObject(key: string, body: Buffer): Promise<void> {
  const dest = resolveSafe(key);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, body);
}

export async function readLocalObject(key: string): Promise<Buffer | null> {
  try {
    return await readFile(resolveSafe(key));
  } catch {
    return null; // missing object or rejected key
  }
}

export async function deleteLocalObject(key: string): Promise<void> {
  try {
    await unlink(resolveSafe(key));
  } catch {
    // already gone — nothing to do
  }
}

export function localKeyToUrl(key: string): string {
  return `/api/images/${key}`;
}
