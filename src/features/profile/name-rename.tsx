"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { checkMemberName } from "@/lib/member-name";
import { renameNameAction } from "@/app/profile/actions";
import type { ProfileName } from "@/server/member-profile";
import { NameField } from "./name-field";
import type { Announce, NameRules } from "./names-shared";

// Renaming in place: the box opens on the current name, Save or Enter keeps
// it, Cancel or Escape leaves it. Past comments follow the new name.
export function NameRename({
  name,
  rules,
  announce,
  onShared,
  onDone,
}: {
  name: ProfileName;
  rules: NameRules;
  announce: Announce;
  onShared: (nameId: string, shared: boolean) => void;
  onDone: () => void;
}) {
  const [value, setValue] = useState(name.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    const check = checkMemberName(value, rules);
    if (!check.ok) {
      setError(check.reason);
      return;
    }
    if (check.name === name.name) {
      onDone();
      return;
    }
    startTransition(async () => {
      const result = await renameNameAction(name.id, check.name);
      if (!result.ok) {
        setError(result.reason);
        requestAnimationFrame(() => input.current?.focus());
        return;
      }
      onShared(name.id, result.sharedWithAnotherMember);
      announce(
        `Renamed to “${result.name.name}”.`,
        result.sharedWithAnotherMember,
      );
      onDone();
    });
  };

  return (
    <form onSubmit={save} noValidate>
      <NameField
        ref={input}
        id={`rename-${name.id}`}
        label={`New name for ${name.name}`}
        visuallyHiddenLabel
        value={value}
        error={error}
        onChange={(next) => {
          setValue(next);
          if (error) setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onDone();
          }
        }}
      >
        <Button type="submit" size="sm" busy={pending} className="min-h-11">
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          unavailable={pending}
          onClick={onDone}
          className="min-h-11"
        >
          Cancel
        </Button>
      </NameField>
    </form>
  );
}
