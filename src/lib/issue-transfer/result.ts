import type { ClearedReference } from "./resolve";

// What an import did, in the shape the modal reports and the operation record
// stores, so a retry can hand back the very same answer.

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

/** What an export left out because the row or object is genuinely gone. */
export type ExportOmissions = Partial<
  Record<"issue" | "image" | "sponsor" | "logo", number>
>;

export const CLEARED_LABELS: Record<ClearedReference["kind"], string> = {
  image: "photo",
  slide: "slideshow photo",
  montage: "empty slideshow",
  sponsor: "sponsor",
  logo: "logo",
};
