import { SAVE_REQUEST_MAX_BYTES } from "../editor-save";

// The one set of caps for issue transfer, used by the exporter and the importer
// (the `import-limit.ts` pattern). An export that would exceed any of them is
// refused before the download starts, so a bundle this site produces is always
// one this site accepts — a cap only the importer knew about would surface as a
// refusal an admin could do nothing about.

/** Bundles are one admin action, not a migration tool: a club's whole archive
 *  is tens of issues, and every one is validated and rewritten in one request. */
export const MAX_BUNDLE_ISSUES = 100;

/** Named entries (issues + images). Well past MAX_BUNDLE_ISSUES × its images,
 *  and what bounds the work of matching manifest names against the archive. */
export const MAX_BUNDLE_ENTRIES = 5000;

/** The upload itself, counted while streaming to the temp file. */
export const MAX_BUNDLE_BYTES = 250 * 1024 * 1024;

/** Everything inflated out of it, counted while inflating — a zip bomb
 *  compresses far below MAX_BUNDLE_BYTES and would otherwise be unbounded. */
export const MAX_INFLATED_BYTES = 300 * 1024 * 1024;

/** Read before anything is trusted, so it is capped before it is parsed. */
export const MAX_MANIFEST_BYTES = 1024 * 1024;

/** One stored image. The upload route re-encodes 12 MB down to well under this. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** One `issue.json`. Its parsed document is held to MAX_DOCUMENT_BYTES below;
 *  this only bounds the read, so a file claiming to be enormous is refused
 *  before it is inflated. */
export const MAX_ISSUE_FILE_BYTES = 2 * 1024 * 1024;

// An imported issue has to stay savable: the editor's save route caps the whole
// request at SAVE_REQUEST_MAX_BYTES, and the document travels inside a JSON
// envelope. The headroom covers that envelope with room to spare — a document
// admitted here must never become an issue whose first autosave is refused.
const SAVE_ENVELOPE_HEADROOM = 16 * 1024;
export const MAX_DOCUMENT_BYTES =
  SAVE_REQUEST_MAX_BYTES - SAVE_ENVELOPE_HEADROOM;

/** Images verified (decoded) at once. Each decode holds a bitmap, so this is
 *  the memory bound as much as the parallelism. */
export const IMAGE_VERIFY_CONCURRENCY = 4;

/** The decisions payload travelling beside the zip, in a request header. Bounded
 *  well under Node's 16 KB header allowance, which the session cookie shares. */
export const MAX_DECISIONS_BYTES = 8 * 1024;

export type ExportSizeCheck = { ok: true } | { ok: false; message: string };

/** Refuse an export that the importer would not accept, while the admin can
 *  still deselect something. Byte totals are checked again as the bundle is
 *  built, since the sizes are only known once the objects are read. */
export function checkExportSelection(count: number): ExportSizeCheck {
  if (count === 0) return { ok: false, message: "Select at least one issue." };
  if (count > MAX_BUNDLE_ISSUES) {
    return {
      ok: false,
      message: `An export can carry ${MAX_BUNDLE_ISSUES} issues at a time. Deselect ${count - MAX_BUNDLE_ISSUES} and try again.`,
    };
  }
  return { ok: true };
}
