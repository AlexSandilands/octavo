"use client";

import { useState, useTransition } from "react";
import { ROW } from "@/components/admin-table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui";
import { externalHref } from "@/lib/rich-text";
import type { SponsorListItem } from "@/lib/sponsors";
import { deleteSponsorAction } from "@/app/admin/sponsors/actions";

// The column widths the header row (sponsors-table.tsx) mirrors.
export const SPONSOR_COLS = {
  link: "sm:w-[200px]",
  until: "sm:w-[170px]",
  actions: "sm:w-[130px]",
};

// One sponsor in the admin list: logo, name, (validated) link, active-until
// with an expired flag, and edit/delete as text buttons. Delete confirms first
// — it's irreversible and can affect issues that reference the sponsor (those
// slots then render nothing).
export function SponsorRow({
  sponsor,
  onEdit,
  onChanged,
}: {
  sponsor: SponsorListItem;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const link = sponsor.href ? externalHref(sponsor.href) : null;

  const remove = () => {
    setConfirming(false);
    startTransition(async () => {
      await deleteSponsorAction(sponsor.id);
      onChanged();
    });
  };

  return (
    <div
      className={`${ROW} flex flex-wrap items-center gap-x-3 gap-y-2 py-3 ${
        pending ? "opacity-40" : ""
      }`}
    >
      <div className="flex min-w-0 basis-full items-center gap-3 sm:basis-0 sm:flex-1">
        <div className="border-lead bg-sheet flex h-10 w-[60px] flex-none items-center justify-center overflow-hidden border">
          {sponsor.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sponsor.logo.url}
              alt=""
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="text-grey-soft font-ui text-[10px] font-semibold tracking-[0.08em]">
              NO LOGO
            </span>
          )}
        </div>
        <div className="text-lead truncate font-ui text-[16px] font-semibold">
          {sponsor.name}
        </div>
      </div>

      <div
        className={`min-w-0 basis-full pl-[72px] sm:flex-none sm:pl-0 ${SPONSOR_COLS.link}`}
      >
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-red block truncate font-ui text-[14px] font-semibold underline decoration-1 underline-offset-4 hover:decoration-2"
          >
            {sponsor.href}
          </a>
        ) : (
          <span className="text-grey-soft font-ui text-[14px]">No link</span>
        )}
      </div>

      <div
        className={`flex items-center gap-2 pl-[72px] sm:pl-0 ${SPONSOR_COLS.until}`}
      >
        {sponsor.activeUntil ? (
          <>
            <span className="text-grey font-ui text-[14px] tabular-nums">
              {sponsor.activeUntil}
            </span>
            {sponsor.expired && (
              <span className="small-caps border-lead text-lead inline-flex h-6 items-center gap-1.5 border px-1.5">
                <span aria-hidden className="bg-red h-2 w-2 rounded-full" />
                Expired
              </span>
            )}
          </>
        ) : (
          <span className="text-grey-soft font-ui text-[14px]">
            No end date
          </span>
        )}
      </div>

      <div
        className={`ml-auto flex items-center justify-end gap-3 sm:ml-0 ${SPONSOR_COLS.actions}`}
      >
        <Button
          variant="link"
          size="sm"
          onClick={onEdit}
          disabled={pending}
          title={`Edit ${sponsor.name}`}
          aria-label={`Edit ${sponsor.name}`}
        >
          Edit
        </Button>
        <Button
          variant="link"
          size="sm"
          onClick={() => setConfirming(true)}
          disabled={pending}
          title={`Delete ${sponsor.name}`}
          aria-label={`Delete ${sponsor.name}`}
        >
          Delete
        </Button>
      </div>

      {confirming && (
        <ConfirmDialog
          title={`Delete “${sponsor.name}”?`}
          body="Any issue that placed this sponsor will show nothing in its slot. This cannot be undone."
          confirmLabel="Delete sponsor"
          working={pending}
          onClose={() => setConfirming(false)}
          onConfirm={remove}
        />
      )}
    </div>
  );
}
