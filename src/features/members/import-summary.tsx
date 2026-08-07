"use client";

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
      <p className="text-muted mt-2.5 font-sans text-[15px] leading-relaxed">
        Done — <strong className="text-ink">{added} added</strong>,{" "}
        {alreadyMembers} already {alreadyMembers === 1 ? "a member" : "members"}
        {updated > 0 && <> ({updated} of them given the name from this file)</>}
        , {invalid} invalid {invalid === 1 ? "row" : "rows"} skipped.
      </p>

      {skippedCount > 0 && (
        <div className="border-line-soft mt-4 rounded-lg border bg-white px-4 py-3 font-sans text-[14px]">
          <p className="text-ink">
            {one ? "One address" : `${skippedCount} addresses`} in the file
            couldn’t be used, so {one ? "it was" : "they were"} left out.
            Everyone else was imported. Correct{" "}
            {one ? "it in your spreadsheet" : "them in your spreadsheet"} and
            import the file again to add {one ? "them" : "the rest"}.
          </p>
          <ul className="text-muted mt-2 space-y-1">
            {skipped.map((row) => (
              <li key={row.row} className="break-words">
                {row.email || `Row ${row.row}`}
              </li>
            ))}
          </ul>
          {rest > 0 && (
            <p className="text-faint mt-1.5 text-[13px]">…and {rest} more.</p>
          )}
        </div>
      )}
    </>
  );
}
