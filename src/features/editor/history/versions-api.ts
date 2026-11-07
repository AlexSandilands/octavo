import {
  restoreResultSchema,
  versionListSchema,
  type RestoreResultJson,
  type VersionSummaryJson,
} from "@/lib/issue-versions";

// The History tab's two requests (aboard #51). Expected refusals come back as
// results; anything else throws for the caller's error state.

const base = (issueId: string) =>
  `/api/admin/issues/${encodeURIComponent(issueId)}/versions`;

export async function fetchVersions(
  issueId: string,
): Promise<VersionSummaryJson[]> {
  const response = await fetch(base(issueId), {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(`Versions request failed (${response.status})`);
  return versionListSchema.parse(await response.json()).versions;
}

export async function postRestore(
  issueId: string,
  versionId: string,
  baseRevision: number,
): Promise<RestoreResultJson> {
  const response = await fetch(
    `${base(issueId)}/${encodeURIComponent(versionId)}/restore`,
    {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseRevision }),
    },
  );
  if (!response.ok && ![400, 404, 409].includes(response.status)) {
    throw new Error(`Restore request failed (${response.status})`);
  }
  return restoreResultSchema.parse(await response.json());
}
