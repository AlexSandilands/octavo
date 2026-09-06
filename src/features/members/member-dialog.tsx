"use client";

import { useState, useTransition } from "react";
import { DialogShell } from "@/components/dialog-shell";
import {
  DialogActions,
  DialogBody,
  DialogHeader,
  Field,
  FIELD_CLASS,
} from "@/components/dialog-parts";
import { Button } from "@/components/ui";
import {
  addMemberAction,
  updateMemberAction,
} from "@/app/admin/members/actions";
import type { MemberRow as Member } from "@/server/users";

// Add or edit one member. Email is required; name is optional (the club often
// only has an address). Passing a `member` switches the dialog to edit mode:
// the fields pre-fill and saving updates that row via updateMemberAction.
// Duplicates and malformed addresses come back as a legible message rather than
// a thrown error. Editing to the member's own current email is not a duplicate.
export function MemberDialog({
  member,
  onClose,
}: {
  member?: Member;
  onClose: () => void;
}) {
  const editing = member != null;
  const [email, setEmail] = useState(member?.email ?? "");
  const [name, setName] = useState(member?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = editing
        ? await updateMemberAction(member.id, {
            email,
            name: name.trim() || undefined,
          })
        : await addMemberAction({ email, name: name.trim() || undefined });
      if (res.ok) {
        onClose();
      } else if (res.reason === "duplicate") {
        setError("That address already belongs to another member.");
      } else if (res.reason === "missing") {
        setError("That member no longer exists. Refresh the page.");
      } else {
        setError("Please enter a valid email address.");
      }
    });
  };

  return (
    <DialogShell
      panelClassName="md:w-[480px]"
      locked={pending}
      onClose={onClose}
    >
      {(titleId) => (
        <form onSubmit={submit}>
          <DialogHeader
            titleId={titleId}
            kicker="Members"
            title={editing ? "Edit member" : "Add a member"}
          />
          <DialogBody>
            <p className="text-fg-muted mt-2 font-ui text-[16px] leading-relaxed">
              {editing
                ? "Fix a name or address. A new email becomes their sign-in link from now on; they stay signed in on any current device."
                : "They’ll be able to sign in and read every issue. Adding an address is all it takes — they don’t register."}
            </p>
            <div className="mt-6 flex flex-col gap-4">
              <Field label="Email address" htmlFor="member-email">
                <input
                  id="member-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className={FIELD_CLASS}
                />
              </Field>
              <Field label="Name (optional)" htmlFor="member-name">
                <input
                  id="member-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Margaret Cole"
                  className={FIELD_CLASS}
                />
              </Field>
            </div>
            {error && (
              <p className="text-danger mt-3 font-ui text-[15px] font-bold">
                {error}
              </p>
            )}
          </DialogBody>
          <DialogActions>
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button
              type="submit"
              busy={pending}
              icon={editing ? "check" : "plus"}
            >
              {editing
                ? pending
                  ? "Saving…"
                  : "Save changes"
                : pending
                  ? "Adding…"
                  : "Add member"}
            </Button>
          </DialogActions>
        </form>
      )}
    </DialogShell>
  );
}
