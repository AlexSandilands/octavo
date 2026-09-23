"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Avatar, Button } from "@/components/ui";
import { initials } from "@/lib/initials";
import { removeNameAction } from "@/app/profile/actions";
import type { ProfileName } from "@/server/member-profile";
import { NameBadge } from "./name-badge";
import { NamePhoto } from "./name-photo";
import { NameRename } from "./name-rename";
import { SHARED_NOTE, type Announce, type NameRules } from "./names-shared";

const RETIRE_NOTE =
  "Your past comments keep this name; you won’t be able to post as it.";

// One posting name: its photo at 64px, the name, and what can be done to it.
export function NameRow({
  name,
  isAdmin,
  isOnly,
  shared,
  rules,
  announce,
  onShared,
  onRemoved,
}: {
  name: ProfileName;
  isAdmin: boolean;
  isOnly: boolean;
  shared: boolean;
  rules: NameRules;
  announce: Announce;
  onShared: (nameId: string, shared: boolean) => void;
  onRemoved: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const renameButton = useRef<HTMLButtonElement>(null);
  const wasRenaming = useRef(false);
  const used = name.commentCount > 0;

  // Back on Rename once the box closes, saved or cancelled.
  useEffect(() => {
    if (wasRenaming.current && !renaming) renameButton.current?.focus();
    wasRenaming.current = renaming;
  }, [renaming]);

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
    <li className="border-line-soft border-t py-5 first:border-t-0">
      <div className="flex items-start gap-4">
        <Avatar initials={initials(name.name)} src={name.avatarUrl} size="lg" />
        <div className="min-w-0 flex-1">
          {renaming ? (
            <NameRename
              name={name}
              rules={rules}
              announce={announce}
              onShared={onShared}
              onDone={() => setRenaming(false)}
            />
          ) : (
            <p className="text-ink flex min-h-11 items-center font-sans text-[18px] font-semibold break-words">
              {name.name}
            </p>
          )}
          {shared && !renaming && (
            <p className="text-muted mt-1 font-sans text-[14px] leading-snug">
              {SHARED_NOTE}
            </p>
          )}
          {isAdmin && <NameBadge name={name} announce={announce} />}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 sm:pl-20">
        {!renaming && (
          <Button
            ref={renameButton}
            variant="secondary"
            size="sm"
            icon="pencil"
            iconPosition="left"
            unavailable={pending}
            aria-label={`Rename ${name.name}`}
            onClick={() => {
              setError(null);
              setRenaming(true);
            }}
            className="min-h-11"
          >
            Rename
          </Button>
        )}
        <NamePhoto
          nameId={name.id}
          name={name.name}
          hasPhoto={name.avatarUrl !== null}
          announce={announce}
          onError={setError}
        />
        <Button
          variant="secondary"
          size="sm"
          icon="trash"
          iconPosition="left"
          unavailable={pending || isOnly}
          aria-label={`Remove ${name.name}`}
          title={
            isOnly ? "You need at least one name to post under." : undefined
          }
          onClick={() => setConfirming(true)}
          className={`min-h-11 ${pending || isOnly ? "" : "hover:text-warn"}`}
        >
          Remove
        </Button>
      </div>
      {error && (
        <p className="text-warn mt-2 font-sans text-[14px] sm:pl-20">{error}</p>
      )}
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
    </li>
  );
}
