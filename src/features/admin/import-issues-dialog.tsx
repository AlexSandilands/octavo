"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DialogShell } from "@/components/dialog-shell";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";
import type { ImportDecision } from "@/lib/issue-transfer/decisions";
import type { BundleManifest } from "@/lib/issue-transfer/manifest";
import type { ImportPlan } from "@/lib/issue-transfer/plan";
import type {
  ImportPhase,
  ImportResponse,
  ImportResult,
} from "@/lib/issue-transfer/result";
import { readBundleManifest } from "./bundle-manifest";
import { askStatus, runImport, type ImportRun } from "./import-run";
import {
  ImportOutcome,
  ImportReview,
  outcomeAnnouncement,
} from "./import-review";

// Nothing is uploaded until the admin has seen what will happen: the browser
// reads only `manifest.json`, a write-free plan request says which library
// entries are already here, and only then does the archive go up.

type Stage = "choose" | "review" | "running" | "done";

// Outcomes where the server's answer never reached us, so the same operation id
// is still the right question to ask.
const RESUMABLE = new Set(["network", "still-running"]);

export function ImportIssuesDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("choose");
  const [file, setFile] = useState<File | null>(null);
  const [manifest, setManifest] = useState<BundleManifest | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [phase, setPhase] = useState<ImportPhase | null>(null);
  const [uploaded, setUploaded] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  // Kept only while the outcome is unknown, so Retry asks what happened rather
  // than importing the same file twice.
  const [operationId, setOperationId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);
  const runRef = useRef<ImportRun | null>(null);

  const running = stage === "running";
  // Past the upload the server finishes whatever happens, so there is nothing
  // left to cancel — and closing now would only hide the answer.
  const waiting = running && uploaded >= 1;
  const ambiguous =
    plan !== null &&
    [...plan.sponsors, ...plan.logos].some((e) => e.outcome === "ambiguous");

  // Escape, the backdrop or an unmount while the archive is still going up must
  // stop it: an upload nobody is watching would still import.
  useEffect(() => () => runRef.current?.cancel(), []);
  const dismiss = () => {
    runRef.current?.cancel();
    onClose();
  };

  // The Import button goes with the result, so focus is placed on the one button
  // left rather than dropped on <body> (issue #133).
  useEffect(() => {
    if (stage === "done") doneRef.current?.focus();
  }, [stage]);

  const choose = async (chosen: File | undefined) => {
    setError(null);
    setResult(null);
    setOperationId(null);
    if (!chosen) return;
    setReading(true);
    try {
      const read = await readBundleManifest(chosen);
      if (!read) {
        setError("This file isn’t a valid issue export.");
        return;
      }
      const response = await fetch("/api/admin/issues/import/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          issues: read.issues.map((i) => ({ id: i.id, title: i.title })),
          sponsors: read.sponsors.map((s) => ({ id: s.id, name: s.name })),
          logos: read.logos.map((l) => ({ id: l.id, name: l.name })),
        }),
      });
      if (!response.ok) {
        setError(
          "Could not check this file against the site. Please try again.",
        );
        return;
      }
      setFile(chosen);
      setManifest(read);
      setPlan((await response.json()) as ImportPlan);
      setStage("review");
    } catch {
      setError("This file isn’t a valid issue export.");
    } finally {
      setReading(false);
    }
  };

  const settle = (response: ImportResponse) => {
    runRef.current = null;
    if (response.ok) {
      setResult(response.result);
      setStage("done");
      router.refresh();
      return;
    }
    setStage("review");
    // Only an outcome the server never gave us is worth retrying under the same
    // id; anything it answered definitively starts a fresh operation.
    if (!RESUMABLE.has(response.code)) setOperationId(null);
    if (response.code !== "cancelled") setError(response.message);
  };

  const start = async () => {
    if (!file || !manifest) return;
    setError(null);
    setPhase(null);
    setUploaded(0);

    // A retry asks what happened before sending the archive again — after a
    // dropped connection on an 80 MB file that is the cheap question.
    if (operationId) {
      setStage("running");
      const known = await askStatus(operationId);
      if (known) {
        settle(known);
        return;
      }
    }

    const id = operationId ?? crypto.randomUUID();
    setOperationId(id);
    setStage("running");
    const run = runImport({
      file,
      operationId: id,
      decisions: manifest.issues.map(
        (issue): ImportDecision => ({ mode: "new", issueId: issue.id }),
      ),
      onProgress: setUploaded,
      onPhase: setPhase,
    });
    runRef.current = run;
    void run.done.then(settle);
  };

  return (
    <DialogShell
      panelClassName="scrollbar-soft bg-card max-h-[90vh] w-[520px] max-w-full overflow-y-auto rounded-[10px] [--scrollbar-surface:var(--color-card)] [scrollbar-gutter:stable] shadow-[0_24px_60px_rgba(0,0,0,0.3)]"
      locked={waiting}
      onClose={dismiss}
    >
      {(titleId) => (
        <>
          <div className="px-8 pt-7">
            <div className="text-accent font-sans text-[10px] font-semibold tracking-[0.2em] uppercase">
              Issues
            </div>
            <h2
              id={titleId}
              className="text-ink mt-3 font-serif text-[27px] leading-tight"
            >
              Import issues
            </h2>

            {stage === "done" && result ? (
              <ImportOutcome result={result} />
            ) : (
              <>
                <p className="text-muted mt-2.5 font-sans text-[15px] leading-relaxed">
                  Choose a file exported from another copy of this site. Each
                  issue in it arrives here as a <strong>new draft</strong>, with
                  no issue number, and nothing is sent to members.
                </p>

                {/* A dashed drop target, as the members CSV import uses. */}
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={running || reading}
                  className="border-line text-muted hover:border-accent hover:bg-accent-wash hover:text-accent disabled:hover:border-line disabled:hover:text-muted mt-5 flex h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border-[1.5px] border-dashed font-sans text-[15px] font-semibold transition-[background-color,border-color,color] duration-150 disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <Icon name="upload" size={18} strokeWidth={1.8} />
                  {reading
                    ? "Reading…"
                    : file
                      ? "Choose a different file"
                      : "Choose export file"}
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".zip,application/zip"
                  className="hidden"
                  onChange={(e) => void choose(e.target.files?.[0])}
                />

                {file && (
                  <p className="text-faint mt-3 font-sans text-[14px]">
                    {file.name} · {formatSize(file.size)}
                  </p>
                )}
                {plan && !running && <ImportReview plan={plan} />}
                {running && (
                  <ImportProgress fraction={uploaded} phase={phase} />
                )}
              </>
            )}

            {/* Always mounted: a live region that arrives with its text is
                announced unreliably. */}
            <p
              role="status"
              aria-live="polite"
              className={
                error ? "text-warn mt-3 font-sans text-[14px]" : "sr-only"
              }
            >
              {error ?? (result ? outcomeAnnouncement(result) : "")}
            </p>
          </div>

          <div className="flex justify-end gap-3 px-8 pt-6 pb-6">
            <Button
              ref={doneRef}
              variant="secondary"
              onClick={() => (running ? runRef.current?.cancel() : onClose())}
              disabled={waiting}
            >
              {stage === "done" ? "Done" : running ? "Cancel upload" : "Cancel"}
            </Button>
            {stage === "review" && (
              <Button
                onClick={() => void start()}
                disabled={!plan || ambiguous}
                icon="check"
                iconPosition="left"
              >
                {operationId ? "Retry" : `Import ${plan?.issues.length ?? 0}`}
              </Button>
            )}
          </div>
        </>
      )}
    </DialogShell>
  );
}

function ImportProgress({
  fraction,
  phase,
}: {
  fraction: number;
  phase: ImportPhase | null;
}) {
  const percent = Math.round(fraction * 100);
  const label =
    phase === "importing"
      ? "Adding the issues…"
      : phase === "checking"
        ? "Checking the file…"
        : `Uploading… ${percent}%`;
  return (
    <div className="mt-5">
      <div
        role="progressbar"
        aria-label="Import progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={phase ? undefined : percent}
        aria-valuetext={label}
        className="bg-stage h-2 w-full overflow-hidden rounded-full"
      >
        <div
          className="bg-accent h-full transition-[width] duration-200"
          style={{ width: `${phase ? 100 : percent}%` }}
        />
      </div>
      <p aria-live="polite" className="text-muted mt-2 font-sans text-[14px]">
        {label}
        {phase ? " This can take a minute — please leave this open." : ""}
      </p>
    </div>
  );
}

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1
    ? `${mb.toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
