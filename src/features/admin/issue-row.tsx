"use client";

import Link from "next/link";
import { ROW_CLASS, RowAction } from "@/components/list-rows";
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

// One issue: a card on a phone, a table line from md. The cover, the title
// (a link to the editor), the facts, a status chip, Edit and Delete.
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
      className={`${ROW_CLASS} flex flex-col gap-3 md:flex-row md:items-center md:gap-4 ${
        selected ? "bg-primary-wash md:bg-primary-wash" : ""
      }`}
    >
      <div className="flex min-w-0 items-center gap-3 md:flex-1 md:gap-4">
        <SelectCheckbox
          checked={selected}
          onChange={(next) => onSelect(issue.id, next)}
          label={`Select ${issue.title}`}
        />
        {/* A decorative duplicate of the title link: out of the tab order
            and the accessibility tree, so each row has one "Edit" name. */}
        <Link
          href={editHref}
          aria-hidden="true"
          tabIndex={-1}
          className="shadow-card flex-none overflow-hidden rounded-[4px]"
          style={{ width: THUMB_W, height: THUMB_H }}
        >
          {issue.thumb ?? <div className="photo-fill h-full w-full" />}
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href={editHref}
            className="text-fg hover:text-primary line-clamp-2 font-ui text-[17px] leading-snug font-bold hover:underline"
          >
            {issue.title}
          </Link>
          <div className="text-fg-muted mt-0.5 font-ui text-[14px]">
            No. {issue.number} · {issue.pages}{" "}
            {issue.pages === 1 ? "page" : "pages"}
          </div>
        </div>
      </div>
      {/* On a phone this strip sits under the title; from md it is the row's
          right-hand columns. */}
      <div className="flex flex-none items-center justify-between gap-2 md:justify-end md:gap-3">
        <Pill status={issue.status === "published" ? "Published" : "Draft"} />
        <div className="flex items-center gap-1">
          <RowAction
            icon="pencil"
            label="Edit"
            ariaLabel={`Edit ${issue.title}`}
            href={editHref}
          />
          <DeleteIssueButton id={issue.id} title={issue.title} />
        </div>
      </div>
    </div>
  );
}
