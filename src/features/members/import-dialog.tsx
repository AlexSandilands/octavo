"use client";

import { useRef, useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { importMembersAction } from "@/app/admin/members/actions";
import { parseMembersCsv, type ParseResult } from "@/lib/parse-members-csv";

type Preview = { fileName: string; parsed: ParseResult };
type Summary = { added: number; alreadyMembers: number; invalid: number };

// Import a members CSV. Parsing and previewing happen entirely in the browser
// (no half-parsed file reaches the server); the admin sees exactly what will be
// added and what was skipped before committing, then a plain-language result.
export function ImportDialog({ onClose }: { onClose: () => void }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File | undefined) => {
    setError(null);
    setSummary(null);
    if (!file) return;
    try {
      const parsed = parseMembersCsv(await file.text());
      setPreview({ fileName: file.name, parsed });
    } catch {
      setError("That file couldn’t be read. Export it again as CSV.");
    }
  };

  const confirmImport = () => {
    if (!preview) return;
    setError(null);
    startTransition(async () => {
      const res = await importMembersAction(preview.parsed.members);
      if (!res.ok) {
        setError("The import couldn’t be completed. Please try again.");
        return;
      }
      setSummary({
        added: res.added,
        alreadyMembers: res.alreadyMembers,
        invalid: preview.parsed.invalid,
      });
    });
  };

  const parsed = preview?.parsed;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(32,32,28,0.4)] p-4">
      <div className="bg-card w-[480px] max-w-full overflow-hidden rounded-[10px] shadow-[0_24px_60px_rgba(0,0,0,0.3)]">
        <div className="px-8 pt-7">
          <div className="text-accent font-sans text-[10px] font-semibold tracking-[0.2em] uppercase">
            Members
          </div>
          <h2 className="text-ink mt-3 font-serif text-[27px] leading-tight">
            Import from CSV
          </h2>

          {summary ? (
            <p className="text-muted mt-2.5 font-sans text-[15px] leading-relaxed">
              Done — <strong className="text-ink">{summary.added} added</strong>
              , {summary.alreadyMembers} already{" "}
              {summary.alreadyMembers === 1 ? "a member" : "members"},{" "}
              {summary.invalid} invalid {summary.invalid === 1 ? "row" : "rows"}{" "}
              skipped.
            </p>
          ) : (
            <>
              <p className="text-muted mt-2.5 font-sans text-[15px] leading-relaxed">
                A file with an <strong>email</strong> column (and an optional{" "}
                <strong>name</strong>). We’ll skip anything that isn’t a valid
                address, and anyone already on the list.
              </p>

              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="border-line text-muted hover:border-accent hover:text-accent mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-lg border-[1.5px] border-dashed font-sans text-[15px] font-semibold"
              >
                <Icon name="upload" size={18} strokeWidth={1.8} />
                {preview ? "Choose a different file" : "Choose CSV file"}
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => void onFile(e.target.files?.[0])}
              />

              {parsed && (
                <div className="border-line-soft mt-4 rounded-lg border bg-white px-4 py-3 font-sans text-[14px]">
                  <div className="text-ink font-semibold">
                    {preview?.fileName}
                  </div>
                  <ul className="text-muted mt-1.5 space-y-0.5">
                    <li>
                      {parsed.members.length} valid{" "}
                      {parsed.members.length === 1 ? "member" : "members"} to
                      import
                    </li>
                    {parsed.duplicates > 0 && (
                      <li>
                        {parsed.duplicates} duplicate{" "}
                        {parsed.duplicates === 1 ? "row" : "rows"} in the file
                        skipped
                      </li>
                    )}
                    {parsed.invalid > 0 && (
                      <li>
                        {parsed.invalid} invalid{" "}
                        {parsed.invalid === 1 ? "row" : "rows"} skipped
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </>
          )}

          {error && (
            <p className="text-warn mt-3 font-sans text-[14px]">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-3 px-8 pt-6 pb-6">
          <button
            type="button"
            onClick={onClose}
            className="border-hair text-ink flex h-12 items-center rounded-lg border-[1.5px] bg-white px-5 font-sans text-[15px] font-semibold"
          >
            {summary ? "Done" : "Cancel"}
          </button>
          {!summary && (
            <button
              type="button"
              onClick={confirmImport}
              disabled={pending || !parsed || parsed.members.length === 0}
              className="bg-accent text-paper flex h-12 items-center gap-2 rounded-lg px-6 font-sans text-[15px] font-semibold shadow-[0_2px_10px_rgba(29,77,62,0.3)] disabled:opacity-50"
            >
              <Icon name="check" size={18} strokeWidth={1.8} />
              {pending
                ? "Importing…"
                : parsed
                  ? `Import ${parsed.members.length}`
                  : "Import"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
