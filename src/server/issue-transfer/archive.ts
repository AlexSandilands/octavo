import "server-only";
import { open, type FileHandle } from "node:fs/promises";
import { MAX_BUNDLE_ENTRIES } from "@/lib/issue-transfer/limits";
import { zip } from "./zip";

// Reading an untrusted archive. Three rules hold here and nowhere else:
//
//   1. an entry name is never a filesystem path — the temp file is opened by a
//      path this process chose, and names are only ever compared as strings,
//   2. only the names the manifest lists are read, and each must match its own
//      path shape exactly, so `__MACOSX/…` and `../…` are simply never asked for,
//   3. sizes are enforced *while inflating*. The central directory's
//      `uncompressedSize` is the archive's own claim; a bounded writer that
//      refuses past its cap is ours.

export class BundleTooLargeError extends Error {}
export class EntryTooLargeError extends Error {}
/** The whole archive inflated past its budget — what a zip bomb trips. */
export class InflationBudgetError extends Error {}

/** Stream a request body to a file, aborting the moment it outgrows the cap
 *  rather than buffering an unbounded upload in memory. */
export async function writeBundleFile(
  body: ReadableStream<Uint8Array>,
  file: string,
  maxBytes: number,
): Promise<number> {
  const handle = await open(file, "w");
  const reader = body.getReader();
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new BundleTooLargeError();
      }
      await handle.write(value);
    }
  } finally {
    reader.releaseLock();
    await handle.close();
  }
  return bytes;
}

// Random access over the temp file: zip.js reads the central directory at the
// end and then seeks to each entry, so nothing is inflated that is not asked
// for. `init` is idempotent because zip.js may re-initialise the reader it was
// handed, and one open handle per read would leak them.
class FileHandleReader extends zip.Reader<string> {
  #handle: FileHandle | null = null;
  #path: string;

  constructor(file: string) {
    super(file);
    this.#path = file;
  }

  async init() {
    if (this.#handle) return;
    this.#handle = await open(this.#path, "r");
    this.size = (await this.#handle.stat()).size;
  }

  async readUint8Array(index: number, length: number) {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await this.#handle!.read(buffer, 0, length, index);
    return new Uint8Array(buffer.subarray(0, bytesRead));
  }

  async release() {
    await this.#handle?.close();
    this.#handle = null;
  }
}

// Counts what actually arrives rather than the size the headers declare, against
// its own cap and the whole bundle's remaining inflation budget.
class BoundedWriter extends zip.Writer<Buffer> {
  #chunks: Uint8Array[] = [];
  #written = 0;
  #cap: number;
  #budget: { remaining: number };
  /** zip.js wraps whatever a writer throws, so the reason is kept here for the
   *  caller to rethrow — the difference between "too big" and "damaged". */
  failure: Error | null = null;

  constructor(cap: number, budget: { remaining: number }) {
    super();
    this.#cap = cap;
    this.#budget = budget;
  }

  async writeUint8Array(array: Uint8Array) {
    this.#written += array.length;
    this.#budget.remaining -= array.length;
    if (this.#budget.remaining < 0)
      throw this.#stop(new InflationBudgetError());
    if (this.#written > this.#cap) throw this.#stop(new EntryTooLargeError());
    this.#chunks.push(array.slice());
  }

  #stop(error: Error): Error {
    this.failure ??= error;
    return error;
  }

  async getData() {
    return Buffer.concat(this.#chunks);
  }
}

export type BundleArchive = {
  has(name: string): boolean;
  /** Inflate one listed entry, refusing past `cap` or the shared budget. */
  read(name: string, cap: number): Promise<Buffer>;
  close(): Promise<void>;
};

export type ArchiveOpenResult =
  | { ok: true; archive: BundleArchive }
  | { ok: false; reason: "not-a-zip" | "too-many-entries" };

export async function openBundle(
  file: string,
  inflatedBudget: number,
): Promise<ArchiveOpenResult> {
  const source = new FileHandleReader(file);
  const reader = new zip.ZipReader(source, { checkSignature: true });
  const close = async () => {
    await reader.close().catch(() => {});
    await source.release();
  };

  // Files only: a directory entry has no data, and the two path shapes the
  // manifest may name are files.
  const entries = new Map<string, zip.FileEntry>();
  try {
    for await (const entry of reader.getEntriesGenerator()) {
      if (entries.size >= MAX_BUNDLE_ENTRIES) {
        await close();
        return { ok: false, reason: "too-many-entries" };
      }
      // A later duplicate is ignored, so a name can only ever mean one entry.
      if (!entry.directory && !entries.has(entry.filename)) {
        entries.set(entry.filename, entry);
      }
    }
  } catch {
    await close();
    return { ok: false, reason: "not-a-zip" };
  }

  const budget = { remaining: inflatedBudget };
  return {
    ok: true,
    archive: {
      has: (name) => entries.has(name),
      read: async (name, cap) => {
        const entry = entries.get(name);
        if (!entry) throw new EntryTooLargeError();
        const writer = new BoundedWriter(cap, budget);
        try {
          return await entry.getData(writer);
        } catch (err) {
          throw writer.failure ?? err;
        }
      },
      close,
    },
  };
}
