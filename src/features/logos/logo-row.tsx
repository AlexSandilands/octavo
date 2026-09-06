"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui";
import type { LogoListItem } from "@/lib/logos";
import { deleteLogoAction } from "@/app/admin/magazine/logo-actions";

// One logo in the library: the mark, its name, and Rename / Delete as text
// buttons. Delete confirms first, and the action refuses outright while
// anything still uses the logo — that refusal surfaces here rather than
// silently doing nothing.
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
      className={`rule-hair flex flex-wrap items-center gap-x-3 gap-y-2 py-3 ${
        pending ? "opacity-40" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        <div className="border-lead bg-sheet flex h-14 w-14 flex-none items-center justify-center overflow-hidden border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logo.image.url}
            alt=""
            className="h-full w-full object-contain p-1"
          />
        </div>
        <div className="min-w-0">
          <div className="text-lead truncate font-ui text-[16px] font-semibold">
            {logo.name}
          </div>
          {logo.image.width && logo.image.height && (
            <div className="text-grey-soft font-ui text-[14px] tabular-nums">
              {logo.image.width}×{logo.image.height}
            </div>
          )}
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="text-red basis-full font-ui text-[14px] font-semibold sm:basis-auto"
        >
          {error}
        </p>
      )}

      <div className="ml-auto flex items-center justify-end gap-3">
        <Button
          variant="link"
          size="sm"
          onClick={onRename}
          disabled={pending}
          title={`Rename ${logo.name}`}
          aria-label={`Rename ${logo.name}`}
        >
          Rename
        </Button>
        <Button
          variant="link"
          size="sm"
          onClick={() => setConfirming(true)}
          disabled={pending}
          title={`Delete ${logo.name}`}
          aria-label={`Delete ${logo.name}`}
        >
          Delete
        </Button>
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
