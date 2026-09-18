import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { readBoundedBody } from "@/lib/bounded-body";
import { sameOrigin } from "@/lib/same-origin";
import { ISSUES_SELECTION_MAX } from "@/features/admin/selection-limit";
import { buildExport } from "@/server/issue-transfer/export";
import { getAdminUser } from "@/server/session";

// Download the selected issues as a bundle (issue #293). A route handler rather
// than a server action: the response is a streamed archive, not a value.
//
// The refusals come back as JSON, so the modal can say what to deselect; only a
// selection that will actually fit an import starts a download.

const MAX_BODY_BYTES = 64 * 1024;

const bodySchema = z
  .object({
    ids: z.array(z.string().uuid()).min(1).max(ISSUES_SELECTION_MAX),
  })
  .strict();

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!sameOrigin(request) || !admin) {
    return Response.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await readBoundedBody(request, MAX_BODY_BYTES);
  if (!body.ok) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  let parsed;
  try {
    parsed = bodySchema.safeParse(JSON.parse(body.bytes.toString("utf8")));
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!parsed.success) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const built = await buildExport(parsed.data.ids);
    if (!built.ok) {
      return Response.json({ error: built.refusal.message }, { status: 400 });
    }
    return new Response(built.body, {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${built.filename}"`,
        "cache-control": "no-store",
        "x-issue-export-omitted": JSON.stringify(built.omitted),
      },
    });
  } catch (error) {
    // Storage refusing to answer lands here: an export with holes in it would
    // be worse than no export, so nothing is sent.
    Sentry.captureException(error, {
      tags: { route: "admin/issues/export" },
      extra: { adminId: admin.id, count: parsed.data.ids.length },
    });
    return Response.json(
      { error: "Could not build the export. Please try again." },
      { status: 500 },
    );
  }
}
