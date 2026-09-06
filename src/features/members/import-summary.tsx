"use client";

import { Icon } from "@/components/icons";
import type { SkippedImportRow } from "@/app/admin/members/actions";

export type ImportSummaryData = {
  added: number;
  alreadyMembers: number;
  updated: number;
  // Rows the file itself yielded no address from, counted while parsing.
  invalid: number;
  // Rows the server refused, with as many of their addresses as it sent back.
  skipped: SkippedImportRow[];
  skippedCount: number;
};

// What the import actually did, in plain language. The refused rows get their
// own block and their addresses in full: the import no longer fails because of
// them, so the admin's only job is to see which ones didn't make it (#124).
export function ImportSummary({ summary }: { summary: ImportSummaryData }) {
  const { added, alreadyMembers, updated, invalid, skipped, skippedCount } =
    summary;
  const one = skippedCount === 1;
  const rest = skippedCount - skipped.length;

  return (
    <>
      <p className="bg-ok-soft text-fg mt-3 flex gap-3 rounded-field p-4 font-ui text-[16px] leading-relaxed">
        <Icon
          name="checkCircle"
          size={22}
          strokeWidth={2}
          className="text-ok mt-0.5 flex-none"
        />
        <span>
          Done — <strong className="text-fg">{added} added</strong>,{" "}
          {alreadyMembers} already{" "}
          {alreadyMembers === 1 ? "a member" : "members"}
          {updated > 0 && (
            <> ({updated} of them given the name from this file)</>
          )}
          , {invalid} invalid {invalid === 1 ? "row" : "rows"} skipped.
        </span>
      </p>

      {skippedCount > 0 && (
        <div className="bg-warn-soft mt-4 rounded-field px-4 py-3 font-ui text-[15px]">
          <p className="text-fg">
            {one ? "One address" : `${skippedCount} addresses`} in the file
            couldn’t be used, so {one ? "it was" : "they were"} left out.
            Everyone else was imported. Correct{" "}
            {one ? "it in your spreadsheet" : "them in your spreadsheet"} and
            import the file again to add {one ? "them" : "the rest"}.
          </p>
          <ul className="text-fg-muted mt-2 space-y-1">
            {skipped.map((row) => (
              <li key={row.row} className="break-words">
                {row.email || `Row ${row.row}`}
              </li>
            ))}
          </ul>
          {rest > 0 && (
            <p className="text-fg-muted mt-1.5 text-[14px]">
              …and {rest} more.
            </p>
          )}
        </div>
      )}
    </>
  );
}

// The same outcome in one breath, for the dialog's live region (#133). It lives
// beside the visible copy so the two can't drift apart. Counts only: the refused
// addresses are on screen to be read and corrected at leisure, and reciting a
// list of them into a single announcement would bury the one number that
// matters — how many members were actually added.
export function importSummaryAnnouncement(summary: ImportSummaryData): string {
  const { added, alreadyMembers, invalid, skippedCount } = summary;
  const one = skippedCount === 1;
  return [
    `Import finished. ${added} added,`,
    `${alreadyMembers} already ${alreadyMembers === 1 ? "a member" : "members"},`,
    `${invalid} invalid ${invalid === 1 ? "row" : "rows"} skipped.`,
    skippedCount > 0 &&
      `${skippedCount} ${one ? "address" : "addresses"} couldn’t be used and ${
        one ? "is" : "are"
      } listed on screen.`,
  ]
    .filter(Boolean)
    .join(" ");
}
