import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { readBoundedBody } from "@/lib/bounded-body";
import { restoreRequestSchema } from "@/lib/issue-versions";
import { sameOrigin } from "@/lib/same-origin";
import { getIssue } from "@/server/issues";
import { restoreVersion } from "@/server/issue-versions";
import { getAdminUser } from "@/server/session";

const idSchema = z.string().uuid();
const STATUS = { invalid: 400, conflict: 409, missing: 404 } as const;

// Puts a kept version's pages back (aboard #51). The body carries the revision
// the editor last saw, so a restore from a stale tab is a conflict like a save.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> },
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
  const { id, versionId } = await params;
  const ids = [idSchema.safeParse(id), idSchema.safeParse(versionId)];
  if (!ids.every((parsed) => parsed.success)) {
    return Response.json({ ok: false, reason: "missing" }, { status: 404 });
  }

  const body = await readBoundedBody(request, 1024);
  let input: unknown;
  try {
    input = body.ok ? JSON.parse(body.bytes.toString("utf8")) : undefined;
  } catch {
    input = undefined;
  }
  const parsed = restoreRequestSchema.safeParse(input);
  if (!parsed.success) {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  }

  try {
    const result = await restoreVersion(
      id,
      versionId,
      parsed.data.baseRevision,
    );
    if (!result.ok) {
      return Response.json(result, { status: STATUS[result.reason] });
    }
    revalidatePath("/admin");
    if ((await getIssue(id))?.status === "published") revalidatePath("/");
    return Response.json(result);
  } catch (error) {
    Sentry.captureException(error, {
      tags: { route: "admin/issues/versions/restore" },
      extra: { issueId: id, versionId },
    });
    return Response.json({ ok: false }, { status: 500 });
  }
}
