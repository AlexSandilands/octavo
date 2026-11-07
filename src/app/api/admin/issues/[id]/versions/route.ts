import { z } from "zod";
import type { VersionSummaryJson } from "@/lib/issue-versions";
import { listVersions } from "@/server/issue-versions";
import { getAdminUser } from "@/server/session";

// The editor's History tab (aboard #51): an issue's kept versions, newest first,
// without their pages.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getAdminUser())) {
    return Response.json({ ok: false }, { status: 403 });
  }
  const id = z
    .string()
    .uuid()
    .safeParse((await params).id);
  if (!id.success) return Response.json({ ok: false }, { status: 404 });

  const versions: VersionSummaryJson[] = (await listVersions(id.data)).map(
    (v) => ({ ...v, savedAt: v.savedAt.toISOString() }),
  );
  return Response.json(
    { versions },
    { headers: { "cache-control": "no-store" } },
  );
}
