"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Avatar, Button } from "@/components/ui";
import { initials } from "@/lib/initials";
import {
  adminClearAvatarAction,
  adminRenameNameAction,
  adminRetireNameAction,
} from "@/app/admin/members/posting-names-actions";
import type { AdminPostingName } from "@/server/member-profile";
import { NameField } from "@/features/profile/name-field";

// One of a member's posting names in the admin's dialog. A live name can be
// renamed (every rule but the profanity filter) or retired; any name with a
// photo can have it cleared.
export function PostingNameItem({
  name,
  announce,
  onRetired,
}: {
  name: AdminPostingName;
  announce: (message: string) => void;
  onRetired: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [value, setValue] = useState(name.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const renameButton = useRef<HTMLButtonElement>(null);
  const opened = useRef(false);

  // Into the box when it opens, back on Rename when it closes.
  useEffect(() => {
    if (renaming) input.current?.focus();
    else if (opened.current) renameButton.current?.focus();
    opened.current = renaming;
  }, [renaming]);

  const act = (
    write: () => Promise<{ ok: boolean; reason?: string }>,
    success: string,
    after?: () => void,
  ) => {
    setError(null);
    startTransition(async () => {
      const result = await write();
      if (!result.ok) {
        const reason = result.reason ?? "Something went wrong.";
        setError(reason);
        announce(reason);
        return;
      }
      announce(success);
      after?.();
    });
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    act(
      () => adminRenameNameAction(name.id, value),
      `Renamed “${name.name}” to “${value.trim()}”.`,
      () => setRenaming(false),
    );
  };

  return (
    <li className="border-line-soft border-t py-4 first:border-t-0">
      <div className="flex items-center gap-3">
        <Avatar initials={initials(name.name)} src={name.avatarUrl} />
        <span className="text-ink min-w-0 flex-1 font-sans text-[16px] font-semibold break-words">
          {name.name}
          {name.retired && (
            <span className="text-faint ml-2 font-sans text-[13px] font-medium">
              Retired
            </span>
          )}
        </span>
      </div>
      {renaming ? (
        <form onSubmit={save} className="mt-3" noValidate>
          <NameField
            ref={input}
            id={`admin-rename-${name.id}`}
            label={`New name for ${name.name}`}
            visuallyHiddenLabel
            value={value}
            error={error}
            onChange={(next) => {
              setValue(next);
              if (error) setError(null);
            }}
          >
            <Button type="submit" size="sm" busy={pending} className="min-h-11">
              {pending ? "Saving…" : "Save"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              unavailable={pending}
              onClick={() => setRenaming(false)}
              className="min-h-11"
            >
              Cancel
            </Button>
          </NameField>
        </form>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2 pl-12">
          {!name.retired && (
            <Button
              ref={renameButton}
              variant="secondary"
              size="sm"
              icon="pencil"
              iconPosition="left"
              unavailable={pending}
              aria-label={`Rename ${name.name}`}
              onClick={() => {
                setValue(name.name);
                setRenaming(true);
              }}
              className="min-h-11"
            >
              Rename
            </Button>
          )}
          {name.avatarUrl && (
            <Button
              variant="secondary"
              size="sm"
              icon="image"
              iconPosition="left"
              unavailable={pending}
              aria-label={`Clear photo from ${name.name}`}
              onClick={() =>
                act(
                  () => adminClearAvatarAction(name.id),
                  `Cleared the photo from “${name.name}”.`,
                )
              }
              className="min-h-11"
            >
              Clear photo
            </Button>
          )}
          {!name.retired && (
            <Button
              variant="secondary"
              size="sm"
              icon="minus"
              iconPosition="left"
              unavailable={pending}
              aria-label={`Retire ${name.name}`}
              onClick={() =>
                act(
                  () => adminRetireNameAction(name.id),
                  `Retired “${name.name}”. It stays on past comments.`,
                  onRetired,
                )
              }
              className="min-h-11"
            >
              Retire
            </Button>
          )}
        </div>
      )}
      {error && !renaming && (
        <p className="text-warn mt-2 pl-12 font-sans text-[14px]">{error}</p>
      )}
    </li>
  );
}
