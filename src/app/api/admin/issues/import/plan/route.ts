import { readBoundedBody } from "@/lib/bounded-body";
import { planRequestSchema, type ImportPlan } from "@/lib/issue-transfer/plan";
import { normaliseLibraryName } from "@/lib/issue-transfer/manifest";
import { sameOrigin } from "@/lib/same-origin";
import {
  findExistingTitles,
  readLibrary,
} from "@/server/issue-transfer/library";
import { getAdminUser } from "@/server/session";

// What an import would do with these names — the modal's Review step. It writes
// nothing and is only ever a courtesy: the import request re-derives every one
// of these answers from the archive itself.

const MAX_BODY_BYTES = 128 * 1024;

export async function POST(request: Request) {
  if (!sameOrigin(request) || !(await getAdminUser())) {
    return Response.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await readBoundedBody(request, MAX_BODY_BYTES);
  if (!body.ok) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  let parsed;
  try {
    parsed = planRequestSchema.safeParse(
      JSON.parse(body.bytes.toString("utf8")),
    );
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!parsed.success) {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const input = parsed.data;
  const [library, existingTitles] = await Promise.all([
    readLibrary(),
    findExistingTitles(input.issues.map((issue) => issue.title)),
  ]);

  const plan: ImportPlan = {
    issues: input.issues.map((issue) => ({
      id: issue.id,
      title: issue.title,
      titleExists: existingTitles.has(normaliseLibraryName(issue.title)),
    })),
    sponsors: matchNames(input.sponsors, library.sponsors),
    logos: matchNames(input.logos, library.logos),
  };
  return Response.json(plan);
}

function matchNames(
  wanted: { id: string; name: string }[],
  destination: { name: string }[],
) {
  const counts = new Map<string, number>();
  for (const row of destination) {
    const key = normaliseLibraryName(row.name);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return wanted.map((row) => {
    const found = counts.get(normaliseLibraryName(row.name)) ?? 0;
    return {
      id: row.id,
      name: row.name,
      outcome:
        found === 0
          ? ("create" as const)
          : found === 1
            ? ("reuse" as const)
            : ("ambiguous" as const),
    };
  });
}
