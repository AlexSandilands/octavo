import * as Sentry from "@sentry/nextjs";
import { readBoundedBody } from "@/lib/bounded-body";
import { SAVE_REQUEST_MAX_BYTES } from "@/lib/editor-save";
import { sameOrigin } from "@/lib/same-origin";
import { getAdminUser } from "@/server/session";
import { saveEditorIssue } from "@/server/editor-save";

// The body cap, applied to chunked requests too.
const MAX_BYTES = SAVE_REQUEST_MAX_BYTES;

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

  const body = await readBoundedBody(request, MAX_BYTES);
  if (!body.ok) {
    return body.reason === "too-large"
      ? Response.json({ ok: false }, { status: 413 })
      : Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
  let input: unknown;
  try {
    input = JSON.parse(body.bytes.toString("utf8"));
  } catch {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
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
