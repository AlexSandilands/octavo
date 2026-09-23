"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { MAX_ACTIVE_NAMES } from "@/lib/comments";
import { checkMemberName } from "@/lib/member-name";
import { addNameAction } from "@/app/profile/actions";
import { NameField } from "./name-field";
import type { NameRules, Announce } from "./names-shared";

// "Add a name": checked in the browser for an instant answer, then again by
// the server, whose sentence is shown as it stands.
export function AddNameForm({
  count,
  suggestion,
  rules,
  announce,
  onShared,
  onFull,
}: {
  count: number;
  suggestion: string;
  rules: NameRules;
  announce: Announce;
  onShared: (nameId: string) => void;
  /** Where focus goes once the box closes behind the fifth name. */
  onFull: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(suggestion);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const full = count >= MAX_ACTIVE_NAMES;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (full || pending) return;
    const check = checkMemberName(value, rules);
    if (!check.ok) {
      setError(check.reason);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await addNameAction(check.name);
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      setValue("");
      if (result.sharedWithAnotherMember) onShared(result.name.id);
      announce(`Added “${result.name.name}”.`, result.sharedWithAnotherMember);
      // The busy button let go of focus; hand it back to the box.
      if (count + 1 >= MAX_ACTIVE_NAMES) onFull();
      else requestAnimationFrame(() => input.current?.focus());
    });
  };

  return (
    <form onSubmit={submit} className="mt-6" noValidate>
      <NameField
        ref={input}
        id="add-name"
        label={count === 0 ? "Your first name to post under" : "Add a name"}
        value={value}
        error={error}
        disabled={full}
        onChange={(next) => {
          setValue(next);
          if (error) setError(null);
        }}
      >
        <Button
          type="submit"
          icon="plus"
          iconPosition="left"
          size="sm"
          busy={pending}
          unavailable={full}
          className="min-h-11 flex-none"
        >
          {pending ? "Adding…" : "Add name"}
        </Button>
      </NameField>
      {full && (
        <p className="text-muted mt-2 font-sans text-[14px]">
          You have {MAX_ACTIVE_NAMES} names, the most one account can hold.
          Remove one to add another.
        </p>
      )}
    </form>
  );
}
