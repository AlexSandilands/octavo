"use client";

import { useState, useTransition } from "react";
import { DIALOG_PANEL, DialogShell } from "@/components/dialog-shell";
import { Button, FIELD, Kicker } from "@/components/ui";
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
      panelClassName={`${DIALOG_PANEL} w-[440px] overflow-hidden`}
      locked={pending}
      onClose={onClose}
    >
      {(titleId) => (
        <form onSubmit={submit}>
          <div className="px-8 pt-7">
            <Kicker>Members</Kicker>
            <h2
              id={titleId}
              className="text-ink mt-3 font-display text-[28px] leading-tight"
            >
              {editing ? "Edit member" : "Add a member"}
            </h2>
            <p className="text-muted mt-2.5 font-ui text-[16px] leading-relaxed">
              {editing
                ? "Fix a name or address. A new email becomes their sign-in link from now on; they stay signed in on any current device."
                : "They’ll be able to sign in and read every issue. Adding an address is all it takes — they don’t register."}
            </p>

            <label
              htmlFor="member-email"
              className="text-faint mt-6 block font-meta text-[12px] font-medium tracking-[0.14em] uppercase"
            >
              Email address
            </label>
            <input
              id="member-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className={`${FIELD} mt-2`}
            />

            <label
              htmlFor="member-name"
              className="text-faint mt-4 block font-meta text-[12px] font-medium tracking-[0.14em] uppercase"
            >
              Name (optional)
            </label>
            <input
              id="member-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Margaret Cole"
              className={`${FIELD} mt-2`}
            />

            {error && (
              <p className="text-danger mt-3 font-ui text-[14px]">{error}</p>
            )}
          </div>

          <div className="flex justify-end gap-3 px-8 pt-6 pb-6">
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button
              type="submit"
              busy={pending}
              icon={editing ? "check" : "plus"}
              iconPosition="left"
            >
              {editing
                ? pending
                  ? "Saving…"
                  : "Save changes"
                : pending
                  ? "Adding…"
                  : "Add member"}
            </Button>
          </div>
        </form>
      )}
    </DialogShell>
  );
}
