"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { MemberDialog } from "./member-dialog";
import { SelectCheckbox } from "@/components/select-checkbox";
import { Avatar, IconButton, Pill } from "@/components/ui";
import { MemberNotes } from "./member-notes-disclosure";
import styles from "./members-layout.module.css";
import { initials } from "@/lib/initials";
import {
  removeMemberAction,
  setAdminAction,
  setSubscribedAction,
} from "@/app/admin/members/actions";
import type { MemberRow as Member } from "@/server/users";

// Turn a guard-rail rejection into a sentence the admin can act on.
const REASONS: Record<string, string> = {
  self: "You can’t change your own access here.",
  "last-admin": "This is the last admin — promote someone else first.",
  missing: "That member no longer exists. Refresh the page.",
  duplicate: "That address is already a member.",
  invalid: "Something went wrong. Please try again.",
};

const joinedLabel = (d: Date) =>
  new Date(d).toLocaleDateString("en-NZ", { month: "short", year: "numeric" });

export function MemberRow({
  member,
  currentUserId,
  selected,
  onSelect,
}: {
  member: Member;
  currentUserId: string;
  selected: boolean;
  onSelect: (id: string, next: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  // The pending destructive action awaiting confirmation, if any.
  const [confirm, setConfirm] = useState<{
    title: string;
    body: string;
    confirmLabel: string;
    confirmIcon: "trash" | "close" | "minus";
    act: () => void;
  } | null>(null);
  const isSelf = member.id === currentUserId;
  const label = member.name ?? member.email;

  const run = (fn: () => Promise<{ ok: boolean; reason?: string }>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok)
        setError(REASONS[res.reason ?? "invalid"] ?? REASONS.invalid!);
    });
  };

  const toggleSubscribed = () =>
    run(() => setSubscribedAction(member.id, !member.subscribed));

  const toggleAdmin = () => {
    // Granting admin is safe and immediate; revoking it (a downgrade) confirms.
    if (!member.isAdmin) {
      run(() => setAdminAction(member.id, true));
      return;
    }
    setConfirm({
      title: `Remove admin access from ${label}?`,
      body: "They stay a member but can no longer manage issues, members or sponsors.",
      confirmLabel: "Remove admin",
      confirmIcon: "minus",
      act: () => run(() => setAdminAction(member.id, false)),
    });
  };

  const remove = () => {
    setConfirm({
      title: `Remove ${label}?`,
      body: "This revokes their access and signs them out. It can’t be undone.",
      confirmLabel: "Remove member",
      confirmIcon: "trash",
      act: () => run(() => removeMemberAction(member.id)),
    });
  };

  return (
    <div className="members-row border-line-soft border-b py-3">
      <div className={styles.grid}>
        <div className={styles.identity}>
          <SelectCheckbox
            checked={selected}
            onChange={(next) => onSelect(member.id, next)}
            label={`Select ${label}`}
          />
          <Avatar initials={initials(label)} />
          <div className={styles.identityText} data-member-cell="identity">
            <div className="text-ink font-sans text-[15px] font-semibold">
              {member.name ?? "—"}
            </div>
            <div className="text-faint font-sans text-[13px]">
              {member.email}
            </div>
          </div>
        </div>

        <div className={styles.notes} data-member-cell="notes">
          <span className={styles.fieldLabel}>Notes</span>
          <MemberNotes notes={member.notes} label={label} />
        </div>

        <div data-member-cell="subscription">
          <span className={styles.fieldLabel}>Subscription</span>
          <button
            type="button"
            onClick={toggleSubscribed}
            disabled={pending}
            title={
              member.subscribed ? "Mark as unsubscribed" : "Mark as subscribed"
            }
            aria-label={`${member.subscribed ? "Unsubscribe" : "Subscribe"} ${label}`}
            className="inline-flex min-h-11 cursor-pointer items-center rounded-full transition-opacity enabled:hover:opacity-75 focus-visible:outline-2 disabled:cursor-default disabled:opacity-40"
          >
            <Pill status={member.subscribed ? "Subscribed" : "Unsubscribed"} />
          </button>
        </div>

        <div data-member-cell="role">
          <span className={styles.fieldLabel}>Role</span>
          <button
            type="button"
            onClick={toggleAdmin}
            disabled={pending || isSelf}
            title={
              isSelf
                ? "You can’t change your own admin access"
                : member.isAdmin
                  ? "Remove admin access"
                  : "Make admin"
            }
            aria-label={`${member.isAdmin ? "Remove admin from" : "Make admin"} ${label}`}
            className="text-muted hover:text-accent flex min-h-11 cursor-pointer items-center gap-1.5 rounded transition-colors font-sans text-[13px] font-medium disabled:cursor-default disabled:opacity-40 disabled:hover:text-current"
          >
            <Icon
              name={member.isAdmin ? "check" : "plus"}
              size={15}
              strokeWidth={1.8}
            />
            {member.isAdmin ? "Admin" : "Make admin"}
          </button>
        </div>

        <div
          className="text-faint font-sans text-[13px]"
          data-member-cell="joined"
        >
          <span className={styles.fieldLabel}>Joined</span>
          <span className="inline-flex min-h-11 items-center">
            {joinedLabel(member.createdAt)}
          </span>
        </div>

        <div className={styles.actions} data-member-cell="actions">
          <IconButton
            icon="pencil"
            size={18}
            label={`Edit ${label}`}
            title="Edit member details"
            onClick={() => setEditing(true)}
            disabled={pending}
          />
          <IconButton
            icon="close"
            size={20}
            label={`Remove ${label}`}
            title={isSelf ? "You can’t remove yourself" : "Remove member"}
            onClick={remove}
            disabled={pending || isSelf}
            className="enabled:hover:text-warn"
          />
        </div>
      </div>

      {error && (
        <p className="text-warn mt-1.5 px-1.5 font-sans text-[13px]">{error}</p>
      )}

      {editing && (
        <MemberDialog member={member} onClose={() => setEditing(false)} />
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          body={confirm.body}
          confirmLabel={confirm.confirmLabel}
          confirmIcon={confirm.confirmIcon}
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            confirm.act();
            setConfirm(null);
          }}
        />
      )}
    </div>
  );
}
