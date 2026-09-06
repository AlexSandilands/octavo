"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ROW_CLASS, RowAction } from "@/components/list-rows";
import { MemberDialog } from "./member-dialog";
import { SelectCheckbox } from "@/components/select-checkbox";
import { Avatar, Pill } from "@/components/ui";
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

// One member: a card on a phone, a table line from md (the column widths
// match members-table's header). The subscription chip and the role are
// buttons that toggle; Edit and Remove sit at the end.
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
    <div
      className={`${ROW_CLASS} ${selected ? "bg-primary-wash md:bg-primary-wash" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
        <div className="flex min-w-0 basis-full items-center gap-3 md:basis-0 md:flex-1">
          <SelectCheckbox
            checked={selected}
            onChange={(next) => onSelect(member.id, next)}
            label={`Select ${label}`}
          />
          <Avatar initials={initials(label)} />
          <div className="min-w-0">
            <div className="text-fg truncate font-ui text-[16px] font-bold">
              {member.name ?? "—"}
            </div>
            <div className="text-fg-muted truncate font-ui text-[14px]">
              {member.email}
            </div>
          </div>
        </div>

        <div className="md:w-[140px]">
          <button
            type="button"
            onClick={toggleSubscribed}
            disabled={pending}
            title={
              member.subscribed ? "Mark as unsubscribed" : "Mark as subscribed"
            }
            aria-label={`${member.subscribed ? "Unsubscribe" : "Subscribe"} ${label}`}
            className="flex h-11 cursor-pointer items-center rounded-full transition-opacity hover:opacity-75 disabled:cursor-default disabled:opacity-40"
          >
            <Pill status={member.subscribed ? "Subscribed" : "Unsubscribed"} />
          </button>
        </div>

        <div className="md:w-[130px]">
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
            className={`flex h-11 cursor-pointer items-center gap-1.5 rounded-full px-3 font-ui text-[14px] font-bold transition-colors disabled:cursor-default disabled:opacity-50 ${
              member.isAdmin
                ? "bg-primary-soft text-primary"
                : "text-fg-muted hover:bg-primary-wash hover:text-primary -ml-3"
            }`}
          >
            <Icon
              name={member.isAdmin ? "shield" : "plus"}
              size={16}
              strokeWidth={2}
            />
            {member.isAdmin ? "Admin" : "Make admin"}
          </button>
        </div>

        <div className="text-fg-muted hidden font-ui text-[14px] md:block md:w-[80px]">
          {joinedLabel(member.createdAt)}
        </div>

        <div className="ml-auto flex items-center justify-end gap-1 md:ml-0 md:w-[176px]">
          <RowAction
            icon="pencil"
            label="Edit"
            ariaLabel={`Edit ${label}`}
            title="Edit name and email"
            disabled={pending}
            onClick={() => setEditing(true)}
          />
          <RowAction
            icon="trash"
            label="Remove"
            tone="danger"
            ariaLabel={`Remove ${label}`}
            title={isSelf ? "You can’t remove yourself" : "Remove member"}
            disabled={pending || isSelf}
            onClick={remove}
          />
        </div>
      </div>

      {error && (
        <p className="text-danger mt-2 font-ui text-[15px] font-bold">
          {error}
        </p>
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
