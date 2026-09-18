import "server-only";
import {
  mkdir,
  readdir,
  readFile,
  rmdir,
  unlink,
  writeFile,
} from "node:fs/promises";
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

// Null is "there is no such object" — a rejected key, a missing file, a path
// that names a directory. Anything else (a permission error, a broken tree) is
// thrown, which is the distinction R2's getObject already makes and the only
// way a caller that must not silently drop an asset can tell the two apart.
export async function readLocalObject(key: string): Promise<Buffer | null> {
  let dest: string;
  try {
    dest = resolveSafe(key);
  } catch {
    return null;
  }
  try {
    return await readFile(dest);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT" || code === "ENOTDIR" || code === "EISDIR") {
      return null;
    }
    throw err;
  }
}

export async function deleteLocalObject(key: string): Promise<void> {
  let dest: string;
  try {
    dest = resolveSafe(key);
    await unlink(dest);
  } catch {
    return; // already gone, or a rejected key — nothing to do
  }
  await pruneEmptyDirs(path.dirname(dest));
}

// A bucket has no directories; the local fallback does, so a swept prefix would
// otherwise leave an empty tree behind for every issue and every import.
async function pruneEmptyDirs(dir: string): Promise<void> {
  for (let at = dir; at.startsWith(ROOT + path.sep); at = path.dirname(at)) {
    try {
      await rmdir(at);
    } catch {
      return; // not empty, or gone
    }
  }
}

// Every key under a folder prefix (the facade guarantees the trailing slash),
// so it maps straight onto a directory walk. A prefix with nothing under it is
// an empty list — the ordinary case of an issue nobody ever downloaded a PDF of.
// Anything else — a permission error, a broken tree — is thrown rather than
// swallowed: unlike a missing object, it means storage did not answer, and the
// caller (the post-delete sweep) is what decides that leaked objects are worth
// reporting.
export async function listLocalKeys(prefix: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(resolveSafe(prefix), {
      recursive: true,
      withFileTypes: true,
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return [];
    throw err;
  }
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path
        .relative(ROOT, path.join(entry.parentPath, entry.name))
        .split(path.sep)
        .join("/"),
    );
}

export function localKeyToUrl(key: string): string {
  return `/api/images/${key}`;
}
