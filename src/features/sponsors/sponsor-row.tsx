"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { ConfirmDialog } from "@/components/confirm-dialog";
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
      className={`border-line-soft flex items-center border-b px-1.5 py-3.5 ${
        pending ? "opacity-40" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="border-line flex h-9 w-[54px] flex-none items-center justify-center overflow-hidden rounded border bg-white">
          {sponsor.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={sponsor.logo.url}
              alt=""
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="text-faint2 font-mono text-[9px]">NO LOGO</span>
          )}
        </div>
        <div className="text-ink truncate font-sans text-[15px] font-semibold">
          {sponsor.name}
        </div>
      </div>

      <div className="w-[190px] pr-3">
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-accent truncate font-sans text-[13px] font-medium hover:underline"
          >
            {sponsor.href}
          </a>
        ) : (
          <span className="text-faint2 font-sans text-[13px]">—</span>
        )}
      </div>

      <div className="flex w-[150px] items-center gap-2">
        {sponsor.activeUntil ? (
          <>
            <span className="text-faint font-sans text-[13px]">
              {sponsor.activeUntil}
            </span>
            {sponsor.expired && (
              <span className="bg-warn-soft text-warn rounded-full px-2 py-0.5 font-sans text-[10px] font-semibold">
                Expired
              </span>
            )}
          </>
        ) : (
          <span className="text-faint2 font-sans text-[13px]">No end date</span>
        )}
      </div>

      <div className="flex w-[80px] items-center justify-end gap-1">
        <button
          type="button"
          onClick={onEdit}
          disabled={pending}
          title={`Edit ${sponsor.name}`}
          aria-label={`Edit ${sponsor.name}`}
          className="text-accent w-9 text-right font-sans text-sm font-semibold disabled:opacity-40"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={pending}
          title={`Delete ${sponsor.name}`}
          aria-label={`Delete ${sponsor.name}`}
          className="text-faint2 hover:text-warn hover:border-warn flex h-9 w-9 items-center justify-center rounded-lg border border-transparent disabled:opacity-40"
        >
          <Icon name="trash" size={17} strokeWidth={1.8} />
        </button>
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
