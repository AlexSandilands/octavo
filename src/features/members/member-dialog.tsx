"use client";

import { useState, useTransition } from "react";
import { nudgeActionCommit } from "@/components/action-commit-rescue";
import { DialogShell } from "@/components/dialog-shell";
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
        nudgeActionCommit();
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
      panelClassName="bg-card w-[440px] max-w-full overflow-hidden rounded-[10px] shadow-[0_24px_60px_rgba(0,0,0,0.3)]"
      locked={pending}
      onClose={onClose}
    >
      {(titleId) => (
        <form onSubmit={submit}>
          <div className="px-8 pt-7">
            <div className="text-accent font-sans text-[10px] font-semibold tracking-[0.2em] uppercase">
              Members
            </div>
            <h2
              id={titleId}
              className="text-ink mt-3 font-serif text-[27px] leading-tight"
            >
              {editing ? "Edit member" : "Add a member"}
            </h2>
            <p className="text-muted mt-2.5 font-sans text-[15px] leading-relaxed">
              {editing
                ? "Fix a name or address. A new email becomes their sign-in link from now on; they stay signed in on any current device."
                : "They’ll be able to sign in and read every issue. Adding an address is all it takes — they don’t register."}
            </p>

            <label
              htmlFor="member-email"
              className="text-faint mt-6 block font-sans text-[11px] font-semibold tracking-[0.2em] uppercase"
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
              className="border-line text-ink mt-2 h-12 w-full rounded-lg border-[1.5px] bg-white px-3.5 font-sans text-[15px] outline-none focus:border-[var(--color-accent)]"
            />

            <label
              htmlFor="member-name"
              className="text-faint mt-4 block font-sans text-[11px] font-semibold tracking-[0.2em] uppercase"
            >
              Name (optional)
            </label>
            <input
              id="member-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Margaret Cole"
              className="border-line text-ink mt-2 h-12 w-full rounded-lg border-[1.5px] bg-white px-3.5 font-sans text-[15px] outline-none focus:border-[var(--color-accent)]"
            />

            {error && (
              <p className="text-warn mt-3 font-sans text-[14px]">{error}</p>
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
