"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { DialogShell } from "@/components/dialog-shell";
import { nudgeActionCommit } from "@/components/action-commit-rescue";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";
import { importMembersAction } from "@/app/admin/members/actions";
import { parseMembersCsv, type ParseResult } from "@/lib/parse-members-csv";
import { ImportPreview } from "./import-preview";
import {
  ImportSummary,
  importSummaryAnnouncement,
  type ImportSummaryData,
} from "./import-summary";
import { MEMBERS_IMPORT_MAX } from "./import-limit";

type Preview = { fileName: string; parsed: ParseResult };

// Import a members CSV. Parsing and previewing happen entirely in the browser
// (no half-parsed file reaches the server); the admin sees exactly what will be
// added and what was skipped before committing, then a plain-language result.
// The preview applies the server's own address test (lib/member-email) and its
// batch cap, so what it counts is what the import writes.
export function ImportDialog({ onClose }: { onClose: () => void }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [summary, setSummary] = useState<ImportSummaryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);

  // The import has landed, and the block holding the Import button unmounts
  // with it — taking the control the admin was standing on, and dropping focus
  // onto <body> (#133). So focus is placed deliberately, on the one button
  // left: "Done" is where this ends either way. Explicitly, not by leaving it
  // to the shell's focus trap, which only pulls focus back on the next Tab —
  // nobody should have to press a key to find out where they are.
  //
  // `pending` is in the condition, not just the deps: the summary paints while
  // the transition is still settling, and for that window Done is disabled by
  // the in-flight lock (#134). Focusing a disabled button is a silent no-op, so
  // firing on the summary alone would put focus nowhere at all and leave the
  // admin on <body> — the exact bug this fixes. Waiting for the lock to release
  // costs a frame and always lands.
  useEffect(() => {
    if (summary && !pending) doneRef.current?.focus();
  }, [summary, pending]);

  const parsed = preview?.parsed;
  // A file the server would refuse whole. Caught here so the admin reads it in
  // the preview and never commits an import that cannot succeed (#124).
  const tooMany = (parsed?.members.length ?? 0) > MEMBERS_IMPORT_MAX;

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
    if (!preview || tooMany) return;
    setError(null);
    startTransition(async () => {
      const res = await importMembersAction(preview.parsed.members);
      if (!res.ok) {
        // Neither message is a bare "try again": a retry that changes nothing
        // fails the same way, so each one names the thing to change (#124).
        setError(
          res.reason === "too-many"
            ? `That file holds more members than one import can take (the most is ${res.limit.toLocaleString()}). Split it into smaller files and import them one after another.`
            : "The import couldn’t be started. Choose the file again — and if it still won’t go, export it once more from your spreadsheet as CSV.",
        );
        return;
      }
      nudgeActionCommit();
      setSummary({
        added: res.added,
        alreadyMembers: res.alreadyMembers,
        updated: res.updated,
        invalid: preview.parsed.invalid,
        skipped: res.skipped,
        skippedCount: res.skippedCount,
      });
    });
  };

  return (
    <DialogShell
      panelClassName="bg-card max-h-[90vh] w-[480px] max-w-full overflow-y-auto rounded-[10px] shadow-[0_24px_60px_rgba(0,0,0,0.3)]"
      locked={pending}
      onClose={onClose}
    >
      {(titleId) => (
        <>
          <div className="px-8 pt-7">
            <div className="text-accent font-sans text-[10px] font-semibold tracking-[0.2em] uppercase">
              Members
            </div>
            <h2
              id={titleId}
              className="text-ink mt-3 font-serif text-[27px] leading-tight"
            >
              Import from CSV
            </h2>

            {summary ? (
              <ImportSummary summary={summary} />
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

            {/* How the import ended, live. Mounted from the moment the dialog
                opens and whatever has happened since — a region that arrives
                together with its text is announced unreliably, and this is the
                highest-stakes action on the page. An error is the visible
                message it has always been; a landed summary is spoken only,
                its words already on screen above in ink. Empty, it has no
                height. Errors and summaries never coexist: starting an import
                clears the error, and a summary is only set when one succeeds. */}
            <p
              role="status"
              aria-live="polite"
              className={
                error ? "text-warn mt-3 font-sans text-[14px]" : "sr-only"
              }
            >
              {error ?? (summary ? importSummaryAnnouncement(summary) : "")}
            </p>
          </div>

          <div className="flex justify-end gap-3 px-8 pt-6 pb-6">
            <Button
              ref={doneRef}
              variant="secondary"
              onClick={onClose}
              disabled={pending}
            >
              {summary ? "Done" : "Cancel"}
            </Button>
            {!summary && (
              <Button
                onClick={confirmImport}
                busy={pending}
                disabled={!parsed || parsed.members.length === 0 || tooMany}
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
        </>
      )}
    </DialogShell>
  );
}
