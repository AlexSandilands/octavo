"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui";
import { removeNameAction } from "@/app/profile/actions";
import type { ProfileName } from "@/server/member-profile";
import { NameBadge } from "./name-badge";
import { NamePhoto } from "./name-photo";
import { NameRename } from "./name-rename";
import { SHARED_NOTE, type Announce, type NameRules } from "./names-shared";

const RETIRE_NOTE =
  "Your past comments keep this name; you won’t be able to post as it.";

// Everything that can be done to one name, shown under its row while open:
// rename, the photo, the admin badge, and Remove last on its own line.
export function NamePanel({
  name,
  isAdmin,
  isOnly,
  shared,
  rules,
  announce,
  onShared,
  onClose,
  onRemoved,
}: {
  name: ProfileName;
  isAdmin: boolean;
  isOnly: boolean;
  shared: boolean;
  rules: NameRules;
  announce: Announce;
  onShared: (nameId: string, shared: boolean) => void;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const used = name.commentCount > 0;
  const stuck = pending || isOnly;

  const remove = () => {
    setConfirming(false);
    setError(null);
    startTransition(async () => {
      const result = await removeNameAction(name.id);
      if (!result.ok) {
        setError(result.reason);
        announce(result.reason);
        return;
      }
      announce(
        result.outcome === "retired"
          ? `Removed “${name.name}”. ${RETIRE_NOTE}`
          : `Removed “${name.name}”.`,
      );
      onRemoved();
    });
  };

  return (
    <div className="space-y-4 pt-4">
      <NameRename
        name={name}
        rules={rules}
        announce={announce}
        onShared={onShared}
        onCancel={onClose}
      />
      {shared && (
        <p className="text-muted font-sans text-[14px] leading-snug">
          {SHARED_NOTE}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <NamePhoto
          nameId={name.id}
          name={name.name}
          hasPhoto={name.avatarUrl !== null}
          announce={announce}
          onError={setError}
        />
      </div>
      {isAdmin && <NameBadge name={name} announce={announce} />}
      <div className="border-line-soft border-t pt-4">
        <Button
          variant="secondary"
          size="sm"
          icon="trash"
          iconPosition="left"
          unavailable={stuck}
          aria-label={`Remove ${name.name}`}
          onClick={() => setConfirming(true)}
          className={`min-h-11 ${stuck ? "" : "hover:text-warn"}`}
        >
          Remove
        </Button>
        {isOnly && (
          <p className="text-muted mt-2 font-sans text-[14px]">
            You need at least one name to post under, so your only name can’t be
            removed. Add another first.
          </p>
        )}
      </div>
      {error && <p className="text-warn font-sans text-[14px]">{error}</p>}
      {confirming && (
        <ConfirmDialog
          title={`Remove “${name.name}”?`}
          body={
            used
              ? `This name is on your comments, so it is retired rather than deleted. ${RETIRE_NOTE}`
              : "You haven’t posted under this name, so it goes completely, with its photo."
          }
          confirmLabel="Remove name"
          onClose={() => setConfirming(false)}
          onConfirm={remove}
        />
      )}
    </div>
  );
}
