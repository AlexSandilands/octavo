"use client";

import Link from "next/link";
import { ROW } from "@/components/admin-table";
import { SelectCheckbox } from "@/components/select-checkbox";
import { Button, Pill } from "@/components/ui";
import { DeleteIssueButton } from "./delete-issue-button";
import { THUMB_H, THUMB_W } from "./issue-thumb";
import type { IssueStatus } from "@/server/issues";

/** One dashboard row's data. `thumb` is the cover, rendered on the server. */
export type IssueRowData = {
  id: string;
  number: number;
  title: string;
  status: IssueStatus;
  pages: number;
  thumb: React.ReactNode;
};

// The column widths the header row (issues-table.tsx) mirrors.
export const ISSUE_COLS = {
  status: "sm:w-[120px]",
  actions: "sm:w-[150px]",
};

export function IssueRow({
  issue,
  selected,
  onSelect,
}: {
  issue: IssueRowData;
  selected: boolean;
  onSelect: (id: string, next: boolean) => void;
}) {
  const editHref = `/admin/issues/${issue.id}/edit`;

  return (
    <div
      className={`${ROW} flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-3`}
    >
      <div className="flex min-w-0 items-center gap-3 sm:flex-1">
        <SelectCheckbox
          checked={selected}
          onChange={(next) => onSelect(issue.id, next)}
          label={`Select ${issue.title}`}
        />
        <Link
          href={editHref}
          aria-label={`Edit ${issue.title}`}
          tabIndex={-1}
          className="border-lead flex-none overflow-hidden border"
          style={{ width: THUMB_W, height: THUMB_H }}
        >
          {issue.thumb ?? <div className="photo-fill h-full w-full" />}
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href={editHref}
            className="text-lead font-display text-[20px] leading-tight font-medium hover:underline"
          >
            {issue.title}
          </Link>
          <div className="text-grey mt-0.5 font-ui text-[14px] tabular-nums">
            No. {issue.number} · {issue.pages}{" "}
            {issue.pages === 1 ? "page" : "pages"}
          </div>
        </div>
      </div>
      {/* On a phone the row wraps and this strip sits under the title, indented
          past the checkbox and thumbnail so it lines up with it. */}
      <div className="flex items-center justify-between gap-3 pl-[102px] sm:contents">
        <div className={ISSUE_COLS.status}>
          <Pill
            status={issue.status === "published" ? "Published" : "Draft"}
          />
        </div>
        <div
          className={`flex items-center justify-end gap-3 ${ISSUE_COLS.actions}`}
        >
          <Button variant="link" size="sm" href={editHref}>
            Edit
          </Button>
          <DeleteIssueButton id={issue.id} title={issue.title} />
        </div>
      </div>
    </div>
  );
}
