"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { KEEP_VERSIONS, type VersionSummaryJson } from "@/lib/issue-versions";
import type { RestoreOutcome } from "../use-editor-autosave";
import { RestoreDialog } from "./restore-dialog";
import { fetchVersions } from "./versions-api";
import { pagesLabel, REASON_LABEL, versionTime } from "./version-copy";

const ROW = "border-line flex flex-col gap-2 border-b px-5 py-3.5";
const ACTION =
  "border-hair-warm text-ink hover:border-accent hover:bg-accent-wash inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[9px] border bg-white px-3 font-sans text-[14px] font-semibold transition-colors duration-150 select-none";

// The side panel's History tab (aboard #51): the pages now, then every kept
// version newest first, each with a preview (a new tab, so the editor stays as
// it is) and a restore. The list is fetched each time the tab is shown.
export function HistoryPanel({
  issueId,
  published,
  shown,
  pageCount,
  restore,
}: {
  issueId: string;
  published: boolean;
  shown: boolean;
  pageCount: number;
  restore: (versionId: string) => Promise<RestoreOutcome>;
}) {
  const [versions, setVersions] = useState<VersionSummaryJson[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [restoring, setRestoring] = useState<VersionSummaryJson | null>(null);

  useEffect(() => {
    if (!shown) return;
    let live = true;
    fetchVersions(issueId).then(
      (list) => {
        if (!live) return;
        setVersions(list);
        setFailed(false);
      },
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [issueId, shown]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <p className="text-muted border-line border-b px-5 py-3 font-sans text-[14px] leading-snug">
        Earlier copies of this issue’s pages. A copy is kept when you come back
        after a break, every hour while you work, and before a large deletion —
        the latest {KEEP_VERSIONS}.
      </p>
      <ol aria-label="Versions" className="flex flex-col">
        <li className={ROW} aria-current="true">
          <span className="text-ink font-sans text-[15px] font-semibold">
            Now
          </span>
          <span className="text-muted font-sans text-[14px]">
            The pages you’re editing · {pagesLabel(pageCount)}
          </span>
        </li>
        {versions?.map((version) => (
          <li key={version.id} className={ROW} data-version={version.id}>
            <span className="text-ink font-sans text-[15px] font-semibold">
              {versionTime(version.savedAt)}
            </span>
            <span className="text-muted font-sans text-[14px]">
              {REASON_LABEL[version.reason]} · {pagesLabel(version.pageCount)}
            </span>
            <span className="flex flex-wrap gap-2">
              <a
                href={`/admin/issues/${issueId}/history/${version.id}`}
                target="_blank"
                rel="noopener"
                className={ACTION}
                aria-label={`Preview the version from ${versionTime(version.savedAt)} (opens in a new tab)`}
              >
                <Icon name="reader" size={15} className="text-accent" />
                Preview
              </a>
              <button
                type="button"
                className={ACTION}
                onClick={() => setRestoring(version)}
                aria-label={`Restore the version from ${versionTime(version.savedAt)}`}
              >
                <Icon name="history" size={15} className="text-accent" />
                Restore
              </button>
            </span>
          </li>
        ))}
      </ol>
      {versions === null && !failed && (
        <p className="text-muted px-5 py-4 font-sans text-[14px]">Loading…</p>
      )}
      {failed && (
        <p role="alert" className="text-warn px-5 py-4 font-sans text-[14px]">
          The versions couldn’t be loaded. Close the tab and open it again to
          retry.
        </p>
      )}
      {versions?.length === 0 && (
        <p
          data-history-empty
          className="text-muted px-5 py-4 font-sans text-[14px] leading-snug"
        >
          No earlier versions yet. The first is kept the next time you come back
          to this issue after a break, or after an hour of work.
        </p>
      )}
      {restoring && (
        <RestoreDialog
          version={restoring}
          published={published}
          restore={() => restore(restoring.id)}
          onDone={() => window.location.reload()}
          onClose={() => setRestoring(null)}
        />
      )}
    </div>
  );
}
