"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { checkMemberName } from "@/lib/member-name";
import { renameNameAction } from "@/app/profile/actions";
import type { ProfileName } from "@/server/member-profile";
import { NameField } from "./name-field";
import type { Announce, NameRules } from "./names-shared";

// The panel's rename box: Save or Enter keeps the new name (past comments
// follow it) and stays open; Cancel closes the panel.
export function NameRename({
  name,
  rules,
  announce,
  onShared,
  onCancel,
}: {
  name: ProfileName;
  rules: NameRules;
  announce: Announce;
  onShared: (nameId: string, shared: boolean) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(name.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    const check = checkMemberName(value, rules);
    if (!check.ok) {
      setError(check.reason);
      return;
    }
    if (check.name === name.name) return;
    startTransition(async () => {
      const result = await renameNameAction(name.id, check.name);
      // The busy Save let go of focus; hand it back to the box.
      requestAnimationFrame(() => input.current?.focus());
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      setValue(result.name.name);
      onShared(name.id, result.sharedWithAnotherMember);
      announce(
        `Renamed to “${result.name.name}”.`,
        result.sharedWithAnotherMember,
      );
    });
  };

  return (
    <form onSubmit={save} noValidate>
      <NameField
        ref={input}
        id={`rename-${name.id}`}
        label="Name"
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
          onClick={onCancel}
          className="min-h-11"
        >
          Cancel
        </Button>
      </NameField>
    </form>
  );
}
