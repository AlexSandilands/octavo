"use client";

import { useRef, useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";
import { importMembersAction } from "@/app/admin/members/actions";
import { parseMembersCsv, type ParseResult } from "@/lib/parse-members-csv";
import { ImportPreview } from "./import-preview";

type Preview = { fileName: string; parsed: ParseResult };
type Summary = {
  added: number;
  alreadyMembers: number;
  updated: number;
  invalid: number;
};

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
        updated: res.updated,
        invalid: preview.parsed.invalid,
      });
    });
  };

  const parsed = preview?.parsed;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(32,32,28,0.4)] p-4">
      <div className="bg-card max-h-[90vh] w-[480px] max-w-full overflow-y-auto rounded-[10px] shadow-[0_24px_60px_rgba(0,0,0,0.3)]">
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
              {summary.alreadyMembers === 1 ? "a member" : "members"}
              {summary.updated > 0 && (
                <> ({summary.updated} of them given the name from this file)</>
              )}
              , {summary.invalid} invalid{" "}
              {summary.invalid === 1 ? "row" : "rows"} skipped.
            </p>
          ) : (
            <>
              <p className="text-muted mt-2.5 font-sans text-[15px] leading-relaxed">
                A file with an <strong>email</strong> column (and an optional{" "}
                <strong>name</strong>, or <strong>first</strong> and{" "}
                <strong>last name</strong> columns). We’ll skip anything that
                isn’t a valid address, and anyone already on the list.
              </p>

              {/* A full-width dashed drop target, not a house Button — it keeps
                  its own shape and gains the wash the accent hover implied. */}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="border-line text-muted hover:border-accent hover:bg-accent-wash hover:text-accent mt-5 flex h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-[1.5px] border-dashed font-sans text-[15px] font-semibold transition-[background-color,border-color,color] duration-150"
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

              {preview && (
                <ImportPreview
                  fileName={preview.fileName}
                  parsed={preview.parsed}
                />
              )}
            </>
          )}

          {error && (
            <p className="text-warn mt-3 font-sans text-[14px]">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-3 px-8 pt-6 pb-6">
          <Button variant="secondary" onClick={onClose}>
            {summary ? "Done" : "Cancel"}
          </Button>
          {!summary && (
            <Button
              onClick={confirmImport}
              busy={pending}
              disabled={!parsed || parsed.members.length === 0}
              icon="check"
              iconPosition="left"
            >
              {pending
                ? "Importing…"
                : parsed
                  ? `Import ${parsed.members.length}`
                  : "Import"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
