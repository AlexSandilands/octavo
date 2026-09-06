"use client";

import Link from "next/link";
import { SelectCheckbox } from "@/components/select-checkbox";
import { Pill } from "@/components/ui";
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
    <div className="border-hairline flex flex-col gap-3 border-b py-4 sm:flex-row sm:items-center sm:gap-5">
      <div className="flex min-w-0 items-center gap-3 sm:flex-1 sm:gap-4">
        <SelectCheckbox
          checked={selected}
          onChange={(next) => onSelect(issue.id, next)}
          label={`Select ${issue.title}`}
        />
        <Link
          href={editHref}
          aria-label={`Edit ${issue.title}`}
          tabIndex={-1}
          className="flex-none overflow-hidden rounded-[3px]"
          style={{ width: THUMB_W, height: THUMB_H }}
        >
          {issue.thumb ?? <div className="photo-fill h-full w-full" />}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <Link
              href={editHref}
              className="text-lead hover:text-red font-display text-[19px] leading-tight hover:underline"
            >
              {issue.title}
            </Link>
            <span className="text-grey-soft font-ui tabular-nums text-[11px]">
              No. {issue.number}
            </span>
          </div>
          <div className="text-grey-soft mt-1 font-ui text-[13px]">
            {issue.pages} {issue.pages === 1 ? "page" : "pages"}
          </div>
        </div>
      </div>
      {/* On a phone the row wraps and this strip sits under the title, indented
          past the checkbox and thumbnail so it lines up with it. */}
      <div className="flex flex-none items-center justify-between gap-3 pl-[114px] sm:justify-end sm:gap-4 sm:pl-0">
        <Pill status={issue.status === "published" ? "Published" : "Draft"} />
        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href={editHref}
            className="text-red text-right font-ui text-sm font-semibold hover:underline sm:w-14"
          >
            Edit
          </Link>
          <DeleteIssueButton id={issue.id} title={issue.title} />
        </div>
      </div>
    </div>
  );
}
