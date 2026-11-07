"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { VersionReason } from "@/lib/issue-versions";
import { RestoreDialog } from "./restore-dialog";
import { postRestore } from "./versions-api";
import { REASON_LABEL, versionTime } from "./version-copy";

// The bar over a version's preview (aboard #51): which version this is, and
// Restore through the same dialog as the History tab. The revision is the one
// this page was rendered at, so an editor that saved since makes it a conflict.
export function VersionBanner({
  issueId,
  revision,
  published,
  version,
}: {
  issueId: string;
  revision: number;
  published: boolean;
  version: {
    id: string;
    savedAt: string;
    reason: VersionReason;
    pageCount: number;
  };
}) {
  const [restoring, setRestoring] = useState(false);
  // In the reader's own time zone: the server's would disagree with History.
  const when = useSyncExternalStore(
    noSubscription,
    () => versionTime(version.savedAt),
    () => null,
  );
  const editor = `/admin/issues/${issueId}/edit`;

  return (
    <div className="bg-accent-wash border-line flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-b px-4 py-2.5 font-sans text-[14px] md:shrink-0">
      <span className="text-ink">
        <span className="font-semibold">
          {when ? `Version from ${when}` : "Earlier version"}
        </span>{" "}
        <span className="text-muted">· {REASON_LABEL[version.reason]}</span>
      </span>
      <button
        type="button"
        onClick={() => setRestoring(true)}
        className="text-accent cursor-pointer font-semibold underline underline-offset-[3px]"
      >
        Restore this version
      </button>
      <Link
        href={editor}
        className="text-ink font-semibold underline underline-offset-[3px]"
      >
        Back to the editor
      </Link>
      {restoring && (
        <RestoreDialog
          version={version}
          published={published}
          restore={() => postRestore(issueId, version.id, revision)}
          // A full load: the editor must start from the restored pages.
          onDone={() => {
            window.location.href = new URL(editor, window.location.href).href;
          }}
          onClose={() => setRestoring(false)}
        />
      )}
    </div>
  );
}

const noSubscription = () => () => {};
