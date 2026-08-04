"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { LogoListItem } from "@/lib/logos";
import { deleteLogoAction } from "@/app/admin/magazine/logo-actions";

// One logo in the admin list: the mark, its name, and rename/delete. Delete
// confirms first, and the action refuses outright while anything still uses the
// logo — that refusal surfaces here rather than silently doing nothing.
export function LogoRow({
  logo,
  onRename,
  onChanged,
}: {
  logo: LogoListItem;
  onRename: () => void;
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = () => {
    setConfirming(false);
    setError(null);
    startTransition(async () => {
      const res = await deleteLogoAction(logo.id);
      if (!res.ok) {
        setError(
          res.reason === "in-use"
            ? "This logo is still used somewhere, so it can’t be deleted yet."
            : "Could not delete. Please try again.",
        );
        return;
      }
      onChanged();
    });
  };

  return (
    <div
      className={`border-line-soft flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-1.5 py-3.5 ${
        pending ? "opacity-40" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <div className="border-line flex h-14 w-14 flex-none items-center justify-center overflow-hidden rounded border bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logo.image.url}
            alt=""
            className="h-full w-full object-contain p-1"
          />
        </div>
        <div className="min-w-0">
          <div className="text-ink truncate font-sans text-[15px] font-semibold">
            {logo.name}
          </div>
          {logo.image.width && logo.image.height && (
            <div className="text-faint2 font-mono text-[11px]">
              {logo.image.width}×{logo.image.height}
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="text-warn basis-full font-sans text-[13px] font-semibold sm:basis-auto">
          {error}
        </p>
      )}

      <div className="ml-auto flex items-center justify-end gap-1 sm:w-[110px]">
        <button
          type="button"
          onClick={onRename}
          disabled={pending}
          title={`Rename ${logo.name}`}
          aria-label={`Rename ${logo.name}`}
          className="text-accent cursor-pointer px-1 text-right font-sans text-sm font-semibold hover:underline disabled:opacity-40"
        >
          Rename
        </button>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={pending}
          title={`Delete ${logo.name}`}
          aria-label={`Delete ${logo.name}`}
          className="text-faint2 hover:text-warn hover:border-warn flex h-9 w-9 items-center justify-center rounded-lg border border-transparent disabled:opacity-40"
        >
          <Icon name="trash" size={17} strokeWidth={1.8} />
        </button>
      </div>

      {confirming && (
        <ConfirmDialog
          title={`Delete “${logo.name}”?`}
          body="The mark is removed from the library. A logo that is still in use somewhere is kept — you'll be told instead. This cannot be undone."
          confirmLabel="Delete logo"
          working={pending}
          onClose={() => setConfirming(false)}
          onConfirm={remove}
        />
      )}
    </div>
  );
}
