// Read a request body with a hard byte cap, counted as it streams rather than
// taken from Content-Length — a chunked request declares no length at all, and
// a declared one is the client's claim. Used by every admin route handler that
// takes a body; route handlers get none of the body limits Server Actions have.
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
