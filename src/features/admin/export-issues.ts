import type { ExportOmissions } from "@/lib/issue-transfer/result";

// Download the selected issues as a bundle. A fetch rather than a plain link so
// a refusal — too many issues, storage unreachable — comes back as a message
// the bulk bar can show instead of a browser error page.

export type ExportOutcome =
  | { ok: true; omitted: ExportOmissions }
  | { ok: false; message: string };

export async function exportIssues(ids: string[]): Promise<ExportOutcome> {
  let response: Response;
  try {
    response = await fetch("/api/admin/issues/export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ids }),
    });
  } catch {
    return { ok: false, message: "That didn’t go through. Please try again." };
  }

  if (!response.ok || !response.headers.get("content-type")?.includes("zip")) {
    const message = await response
      .json()
      .then((body: { error?: string }) => body.error)
      .catch(() => undefined);
    return {
      ok: false,
      message: message ?? "That didn’t go through. Please try again.",
    };
  }

  const omitted = parseOmissions(
    response.headers.get("x-issue-export-omitted"),
  );
  const filename =
    /filename="([^"]+)"/.exec(
      response.headers.get("content-disposition") ?? "",
    )?.[1] ?? "issues.zip";

  let blob: Blob;
  try {
    blob = await response.blob();
  } catch {
    // The stream failed part-way: the server found an asset it could not read
    // and stopped rather than send a bundle with holes in it.
    return {
      ok: false,
      message: "The export stopped part-way through. Please try again.",
    };
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return { ok: true, omitted };
}

function parseOmissions(header: string | null): ExportOmissions {
  if (!header) return {};
  try {
    const value: unknown = JSON.parse(header);
    if (!value || typeof value !== "object") return {};
    const omitted: ExportOmissions = {};
    for (const kind of ["issue", "image", "sponsor", "logo"] as const) {
      const count = (value as Record<string, unknown>)[kind];
      if (typeof count === "number" && count > 0) omitted[kind] = count;
    }
    return omitted;
  } catch {
    return {};
  }
}

const OMISSION_LABELS: Record<keyof ExportOmissions, [string, string]> = {
  issue: ["issue", "issues"],
  image: ["photo", "photos"],
  sponsor: ["sponsor", "sponsors"],
  logo: ["logo", "logos"],
};

/** One plain sentence for whatever the export could not include, or null. */
export function omissionNote(omitted: ExportOmissions): string | null {
  const parts = (Object.keys(OMISSION_LABELS) as (keyof ExportOmissions)[])
    .filter((kind) => (omitted[kind] ?? 0) > 0)
    .map((kind) => {
      const count = omitted[kind]!;
      const [one, many] = OMISSION_LABELS[kind];
      return `${count} ${count === 1 ? one : many}`;
    });
  if (parts.length === 0) return null;
  const listed =
    parts.length === 1
      ? parts[0]!
      : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
  const plural = parts.length > 1 || !listed.startsWith("1 ");
  return `${listed} ${plural ? "are" : "is"} no longer on this site, so ${plural ? "they were" : "it was"} left out.`;
}
