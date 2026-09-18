import type { ClearedReference } from "./resolve";

// What an import did, in the shape the modal reports and the operation record
// stores — so a retry after a lost response can hand back the very same answer.

/** Which half of the work the server is on, reported while the modal waits. */
export type ImportPhase = "checking" | "importing";

export type ImportedIssue = { id: string; title: string };
export type ImportedLibraryEntry = { name: string; action: "reuse" | "create" };

export type ImportResult = {
  issues: ImportedIssue[];
  sponsors: ImportedLibraryEntry[];
  logos: ImportedLibraryEntry[];
  cleared: ClearedReference[];
};

export type ImportResponse =
  | { ok: true; result: ImportResult; retried?: true }
  | { ok: false; code: string; message: string };

/** What an export could not include: a row or an object that is genuinely gone.
 *  Counted by kind and reported beside the download. */
export type ExportOmissions = Partial<
  Record<"issue" | "image" | "sponsor" | "logo", number>
>;

/** Plain-English counts of what was cleared, for the result panel. */
export const CLEARED_LABELS: Record<ClearedReference["kind"], string> = {
  image: "photo",
  slide: "slideshow photo",
  montage: "empty slideshow",
  sponsor: "sponsor",
  logo: "logo",
};
