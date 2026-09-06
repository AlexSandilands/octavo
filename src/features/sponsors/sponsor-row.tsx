"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ROW_CLASS, RowAction } from "@/components/list-rows";
import { Chip } from "@/components/ui";
import { externalHref } from "@/lib/rich-text";
import type { SponsorListItem } from "@/lib/sponsors";
import { deleteSponsorAction } from "@/app/admin/sponsors/actions";

// One sponsor in the admin list: logo, name, (validated) link, active-until
// with an expired flag, and edit/delete. Delete confirms first — it's
// irreversible and can affect issues that reference the sponsor (those slots
// then render nothing).
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
      className={`${ROW_CLASS} flex flex-wrap items-center gap-x-3 gap-y-3 ${
        pending ? "opacity-40" : ""
      }`}
    >
      <div className="flex min-w-0 basis-full items-center gap-3 md:basis-0 md:flex-1">
        <div className="border-hairline bg-surface flex h-11 w-16 flex-none items-center justify-center overflow-hidden rounded-[8px] border">
          {sponsor.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sponsor.logo.url}
              alt=""
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="text-fg-muted font-ui text-[10px] font-bold tracking-[0.08em]">
              NO LOGO
            </span>
          )}
        </div>
        <div className="min-w-0">
          <div className="text-fg truncate font-ui text-[16px] font-bold">
            {sponsor.name}
          </div>
          {/* The link sits under the name on a phone; from md it has a column. */}
          <div className="min-w-0 md:hidden">
            <LinkCell href={sponsor.href} link={link} />
          </div>
        </div>
      </div>

      <div className="hidden min-w-0 pr-3 md:block md:w-[220px] md:flex-none">
        <LinkCell href={sponsor.href} link={link} />
      </div>

      <div className="flex items-center gap-2 md:w-[170px]">
        {sponsor.activeUntil ? (
          <>
            <span className="text-fg-muted font-ui text-[14px]">
              {sponsor.activeUntil}
            </span>
            {sponsor.expired && (
              <span className="bg-warn-soft text-warn inline-flex h-7 items-center rounded-full px-2.5 font-ui text-[13px] font-bold">
                Expired
              </span>
            )}
          </>
        ) : (
          <Chip>No end date</Chip>
        )}
      </div>

      <div className="ml-auto flex items-center justify-end gap-1 md:ml-0 md:w-[176px]">
        <RowAction
          icon="pencil"
          label="Edit"
          ariaLabel={`Edit ${sponsor.name}`}
          disabled={pending}
          onClick={onEdit}
        />
        <RowAction
          icon="trash"
          label="Delete"
          tone="danger"
          ariaLabel={`Delete ${sponsor.name}`}
          disabled={pending}
          onClick={() => setConfirming(true)}
        />
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

function LinkCell({
  href,
  link,
}: {
  href: string | null;
  link: string | null;
}) {
  if (!link)
    return <span className="text-fg-muted font-ui text-[14px]">No link</span>;
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="text-primary block truncate font-ui text-[14px] font-bold hover:underline"
    >
      {href}
    </a>
  );
}
