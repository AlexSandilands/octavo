"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RowAction } from "@/components/list-rows";
import type { LogoListItem } from "@/lib/logos";
import { deleteLogoAction } from "@/app/admin/magazine/logo-actions";

// One logo in the library: the mark, its name, and rename/delete. Delete
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
      className={`bg-surface-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-field p-3 ${
        pending ? "opacity-40" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <div className="border-hairline bg-surface flex h-14 w-14 flex-none items-center justify-center overflow-hidden rounded-[8px] border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logo.image.url}
            alt=""
            className="h-full w-full object-contain p-1"
          />
        </div>
        <div className="min-w-0">
          <div className="text-fg truncate font-ui text-[16px] font-bold">
            {logo.name}
          </div>
          {logo.image.width && logo.image.height && (
            <div className="text-fg-muted font-ui text-[13px] tabular-nums">
              {logo.image.width}×{logo.image.height}
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="text-danger basis-full font-ui text-[15px] font-bold">
          {error}
        </p>
      )}

      <div className="ml-auto flex items-center justify-end gap-1">
        <RowAction
          icon="pencil"
          label="Rename"
          ariaLabel={`Rename ${logo.name}`}
          disabled={pending}
          onClick={onRename}
        />
        <RowAction
          icon="trash"
          label="Delete"
          tone="danger"
          ariaLabel={`Delete ${logo.name}`}
          disabled={pending}
          onClick={() => setConfirming(true)}
        />
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
