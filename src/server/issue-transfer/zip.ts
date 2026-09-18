import "server-only";
import * as zip from "@zip.js/zip.js";

// zip.js, configured once, plus the one writing helper. Workers are off: the
// nonce CSP blocks the blob worker zip.js would otherwise spawn.
zip.configure({ useWebWorkers: false });

export { zip };

/** `store` keeps the bytes as they are: WebP gains nothing from deflate. */
export type AddEntry = (
  name: string,
  bytes: Buffer,
  options?: { store?: boolean },
) => Promise<void>;

/**
 * A zip as a response body, built while it is being sent — so only one entry's
 * bytes are held at a time. A failure part-way through errors the stream, which
 * is what stops a truncated archive arriving as if it were whole.
 */
export function streamZip(
  build: (add: AddEntry) => Promise<void>,
): ReadableStream<Uint8Array> {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let resume: (() => void) | null = null;
  let cancelled = false;

  const wake = () => {
    const pending = resume;
    resume = null;
    pending?.();
  };

  // Backpressure by hand: if the consumer is behind, wait for the next pull.
  const sink = new (class extends zip.Writer<void> {
    async writeUint8Array(array: Uint8Array) {
      if (cancelled) throw new Error("export cancelled");
      controller.enqueue(array.slice());
      if ((controller.desiredSize ?? 1) <= 0) {
        await new Promise<void>((settle) => {
          resume = settle;
        });
      }
    }
    async getData() {}
  })();

  return new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
      const writer = new zip.ZipWriter(sink);
      void (async () => {
        try {
          await build(async (name, bytes, options) => {
            await writer.add(name, new zip.Uint8ArrayReader(bytes), {
              level: options?.store ? 0 : undefined,
            });
          });
          await writer.close();
          if (!cancelled) c.close();
        } catch (err) {
          if (!cancelled) c.error(err);
        }
      })();
    },
    pull: wake,
    cancel() {
      cancelled = true;
      wake();
    },
  });
}
