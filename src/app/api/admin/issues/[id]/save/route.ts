import * as Sentry from "@sentry/nextjs";
import { getAdminUser } from "@/server/session";
import { saveEditorIssue } from "@/server/editor-save";

// Match the previous Server Action body cap, including chunked requests.
const MAX_BYTES = 1024 * 1024;

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    const url = new URL(origin);
    return /^https?:$/.test(url.protocol) && url.host === host;
  } catch {
    return false;
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(request) || !(await getAdminUser())) {
    return Response.json({ ok: false }, { status: 403 });
  }
  if (
    request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !==
    "application/json"
  ) {
    return Response.json({ ok: false }, { status: 415 });
  }

  const reader = request.body?.getReader();
  if (!reader) {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
  let input: unknown;
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        return Response.json({ ok: false }, { status: 413 });
      }
      chunks.push(value);
    }
    input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  } finally {
    reader.releaseLock();
  }

  const { id } = await params;
  try {
    const result = await saveEditorIssue(id, input);
    const status = result.ok
      ? 200
      : { invalid: 400, conflict: 409, missing: 404 }[result.reason];
    return Response.json(result, { status });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { route: "admin/issues/save" },
      extra: { issueId: id },
    });
    return Response.json({ ok: false }, { status: 500 });
  }
}
