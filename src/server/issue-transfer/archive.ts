import "server-only";
import { open, type FileHandle } from "node:fs/promises";
import { MAX_BUNDLE_ENTRIES } from "@/lib/issue-transfer/limits";
import { zip } from "./zip";

// Reading an untrusted archive: entry names are never filesystem paths, only the
// names the manifest lists are ever asked for, and sizes are enforced while
// inflating rather than believed from the central directory.

export class BundleTooLargeError extends Error {}
export class EntryTooLargeError extends Error {}
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

// `init` is idempotent: zip.js may re-initialise the reader it was handed, and
// one open handle per read would leak them.
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

class BoundedWriter extends zip.Writer<Buffer> {
  #chunks: Uint8Array[] = [];
  #written = 0;
  #cap: number;
  #budget: { remaining: number };
  // zip.js wraps whatever a writer throws, so the reason is kept for the caller
  // to rethrow — the difference between "too big" and "damaged".
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
  /** Names the archive holds more than once. A listed name among them is
   *  refused: "first wins" is where zip parser differentials live. */
  readonly duplicated: ReadonlySet<string>;
  /** Inflate an entry that has not been checked yet; draws on the zip-bomb
   *  budget shared by the whole archive. */
  read(name: string, cap: number): Promise<Buffer>;
  /** Inflate an entry already matched against its declared size and hash. It
   *  cannot be a bomb, so it gets its own budget rather than spending the
   *  shared one a second time. */
  reread(name: string, cap: number): Promise<Buffer>;
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

  const entries = new Map<string, zip.FileEntry>();
  const duplicated = new Set<string>();
  let scanned = 0;
  try {
    for await (const entry of reader.getEntriesGenerator()) {
      // Every entry counts towards the cap, directories and repeats included —
      // otherwise a million of either never trips it.
      if (++scanned > MAX_BUNDLE_ENTRIES) {
        await close();
        return { ok: false, reason: "too-many-entries" };
      }
      if (entry.directory) continue;
      if (entries.has(entry.filename)) duplicated.add(entry.filename);
      else entries.set(entry.filename, entry);
    }
  } catch {
    await close();
    return { ok: false, reason: "not-a-zip" };
  }

  const budget = { remaining: inflatedBudget };
  const inflate = async (
    name: string,
    cap: number,
    against: { remaining: number },
  ) => {
    const entry = entries.get(name);
    if (!entry) throw new EntryTooLargeError();
    const writer = new BoundedWriter(cap, against);
    try {
      return await entry.getData(writer);
    } catch (err) {
      throw writer.failure ?? err;
    }
  };

  return {
    ok: true,
    archive: {
      has: (name) => entries.has(name),
      duplicated,
      read: (name, cap) => inflate(name, cap, budget),
      reread: (name, cap) => inflate(name, cap, { remaining: cap }),
      close,
    },
  };
}
