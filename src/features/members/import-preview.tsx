"use client";

import type { ParseResult } from "@/lib/parse-members-csv";
import { MEMBERS_IMPORT_MAX } from "./import-limit";

// How many parsed rows the admin sees before committing. Enough to recognise
// the file (and to catch a name column we read wrong) without a wall of text.
const SAMPLE_SIZE = 5;

// What the import is about to do, in the file's own words: the counts, plus the
// first few rows exactly as they were read. A name column we failed to spot
// shows up here as a list of addresses with no names — visible before the
// import, not discovered weeks later in the members table.
export function ImportPreview({
  fileName,
  parsed,
}: {
  fileName: string;
  parsed: ParseResult;
}) {
  const sample = parsed.members.slice(0, SAMPLE_SIZE);
  const rest = parsed.members.length - sample.length;
  const tooMany = parsed.members.length > MEMBERS_IMPORT_MAX;

  return (
    <div className="border-line-soft mt-4 rounded-lg border bg-white px-4 py-3 font-sans text-[14px]">
      <div className="text-ink font-semibold">{fileName}</div>
      <ul className="text-muted mt-1.5 space-y-0.5">
        <li>
          {parsed.members.length} valid{" "}
          {parsed.members.length === 1 ? "member" : "members"} to import
        </li>
        {parsed.duplicates > 0 && (
          <li>
            {parsed.duplicates} duplicate{" "}
            {parsed.duplicates === 1 ? "row" : "rows"} in the file skipped
          </li>
        )}
        {parsed.invalid > 0 && (
          <li>
            {parsed.invalid} invalid {parsed.invalid === 1 ? "row" : "rows"}{" "}
            skipped
          </li>
        )}
      </ul>

      {/* Said before the admin commits, not after a failed import: one import
          can only carry so many people, and this file carries more (#124). */}
      {tooMany && (
        <p className="text-warn mt-2 leading-relaxed">
          That&rsquo;s more than one import can take — the most is{" "}
          {MEMBERS_IMPORT_MAX.toLocaleString()}. Split the file into smaller
          ones and import them one after another.
        </p>
      )}

      {sample.length > 0 && (
        <div className="border-line-soft mt-3 border-t pt-2.5">
          <div className="text-faint text-[11px] font-semibold tracking-[0.14em] uppercase">
            {rest > 0 ? `First ${sample.length} of them` : "What we read"}
          </div>
          <ul className="mt-1.5 space-y-1">
            {sample.map((member) => (
              <li key={member.email} className="flex flex-wrap gap-x-2">
                <span className="text-ink">{member.email}</span>
                {member.name ? (
                  <span className="text-muted">{member.name}</span>
                ) : (
                  <span className="text-faint italic">no name</span>
                )}
              </li>
            ))}
          </ul>
          {rest > 0 && (
            <p className="text-faint mt-1.5 text-[13px]">…and {rest} more.</p>
          )}
        </div>
      )}
    </div>
  );
}
