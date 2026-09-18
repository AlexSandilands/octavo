import { SAVE_REQUEST_MAX_BYTES } from "../editor-save";

// The caps the exporter and the importer share, so a bundle this site produces
// is always one this site accepts (docs/issue-transfer.md#the-caps).

export const MAX_BUNDLE_ISSUES = 100;
export const MAX_BUNDLE_ENTRIES = 5000;
export const MAX_BUNDLE_BYTES = 250 * 1024 * 1024;

// A zip bomb compresses far below MAX_BUNDLE_BYTES, so what comes out is
// budgeted separately from what went in.
export const MAX_INFLATED_BYTES = 300 * 1024 * 1024;

export const MAX_MANIFEST_BYTES = 1024 * 1024;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_ISSUE_FILE_BYTES = 2 * 1024 * 1024;

// Room for the save route's JSON envelope, so a document admitted here can
// never become an issue whose first autosave is refused.
const SAVE_ENVELOPE_HEADROOM = 16 * 1024;
export const MAX_DOCUMENT_BYTES =
  SAVE_REQUEST_MAX_BYTES - SAVE_ENVELOPE_HEADROOM;

// Each decode holds a bitmap, so this bounds memory as much as parallelism.
export const IMAGE_VERIFY_CONCURRENCY = 4;

// Well under Node's 16 KB header allowance, which the session cookie shares.
export const MAX_DECISIONS_BYTES = 8 * 1024;

export type ExportSizeCheck = { ok: true } | { ok: false; message: string };

/** Refuse an export the importer would not accept, while the admin can still
 *  deselect something. Byte totals are checked again as the bundle is built. */
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
