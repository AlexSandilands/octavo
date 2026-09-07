"use client";

import { useState, useTransition } from "react";
import { ROW } from "@/components/admin-table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { MemberDialog } from "./member-dialog";
import { SelectCheckbox } from "@/components/select-checkbox";
import { Avatar, Button, Pill } from "@/components/ui";
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

// The column widths the header row (members-table.tsx) mirrors.
export const MEMBER_COLS = {
  subscription: "sm:w-[130px]",
  role: "sm:w-[90px]",
  joined: "sm:w-[80px]",
  actions: "sm:w-[300px]",
};

// One member: who they are, their subscription and role as boxed words, when
// they joined, and every action as a labelled text button — nothing to hover
// to discover.
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
    <div className={`${ROW} py-3`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 basis-full items-center gap-3 sm:basis-0 sm:flex-1">
          <SelectCheckbox
            checked={selected}
            onChange={(next) => onSelect(member.id, next)}
            label={`Select ${label}`}
          />
          <Avatar initials={initials(label)} />
          <div className="min-w-0">
            <div className="text-lead font-ui text-[16px] font-semibold">
              {member.name ?? "—"}
            </div>
            <div className="text-grey truncate font-ui text-[14px]">
              {member.email}
            </div>
          </div>
        </div>

        <div className={`pl-[92px] sm:pl-0 ${MEMBER_COLS.subscription}`}>
          <Pill status={member.subscribed ? "Subscribed" : "Unsubscribed"} />
        </div>

        <div
          className={`text-grey font-ui text-[15px] ${MEMBER_COLS.role}`}
        >
          {member.isAdmin ? "Admin" : "Member"}
        </div>

        <div
          className={`text-grey hidden font-ui text-[15px] whitespace-nowrap tabular-nums sm:block ${MEMBER_COLS.joined}`}
        >
          {joinedLabel(member.createdAt)}
        </div>

        <div
          className={`flex basis-full flex-wrap items-center gap-x-3 pl-[92px] sm:basis-auto sm:justify-end sm:pl-0 ${MEMBER_COLS.actions}`}
        >
          <Button
            variant="link"
            size="sm"
            onClick={toggleSubscribed}
            disabled={pending}
            title={
              member.subscribed ? "Mark as unsubscribed" : "Mark as subscribed"
            }
            aria-label={`${member.subscribed ? "Unsubscribe" : "Subscribe"} ${label}`}
          >
            {member.subscribed ? "Unsubscribe" : "Subscribe"}
          </Button>
          <Button
            variant="link"
            size="sm"
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
          >
            {member.isAdmin ? "Remove admin" : "Make admin"}
          </Button>
          <Button
            variant="link"
            size="sm"
            onClick={() => setEditing(true)}
            disabled={pending}
            title="Edit name and email"
            aria-label={`Edit ${label}`}
          >
            Edit
          </Button>
          <Button
            variant="link"
            size="sm"
            onClick={remove}
            disabled={pending || isSelf}
            title={isSelf ? "You can’t remove yourself" : "Remove member"}
            aria-label={`Remove ${label}`}
          >
            Remove
          </Button>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="text-red mt-1.5 pl-[92px] font-ui text-[14px]"
        >
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
