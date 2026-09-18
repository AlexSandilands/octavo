// Read a request body under a hard cap, counted as it streams: a chunked request
// declares no length, and a declared one is the client's claim.
export type BoundedBody =
  | { ok: true; bytes: Buffer }
  | { ok: false; reason: "too-large" | "unreadable" };

export async function readBoundedBody(
  request: Request,
  maxBytes: number,
): Promise<BoundedBody> {
  const reader = request.body?.getReader();
  if (!reader) return { ok: false, reason: "unreadable" };
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return { ok: false, reason: "too-large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: "unreadable" };
  } finally {
    reader.releaseLock();
  }
  return { ok: true, bytes: Buffer.concat(chunks) };
}
