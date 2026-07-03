"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/icons";
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

export function MemberRow({
  member,
  currentUserId,
}: {
  member: Member;
  currentUserId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
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
    if (
      member.isAdmin &&
      !window.confirm(`Remove admin access from ${label}?`)
    ) {
      return;
    }
    run(() => setAdminAction(member.id, !member.isAdmin));
  };

  const remove = () => {
    if (
      window.confirm(
        `Remove ${label}? This revokes their access and signs them out. It can’t be undone.`,
      )
    ) {
      run(() => removeMemberAction(member.id));
    }
  };

  return (
    <div className="border-line-soft border-b py-3">
      <div className="flex items-center gap-3 px-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar initials={initials(label)} />
          <div className="min-w-0">
            <div className="text-ink font-sans text-[15px] font-semibold">
              {member.name ?? "—"}
            </div>
            <div className="text-faint truncate font-sans text-[13px]">
              {member.email}
            </div>
          </div>
        </div>

        <div className="w-[120px]">
          <button
            type="button"
            onClick={toggleSubscribed}
            disabled={pending}
            title={
              member.subscribed ? "Mark as unsubscribed" : "Mark as subscribed"
            }
            aria-label={`${member.subscribed ? "Unsubscribe" : "Subscribe"} ${label}`}
            className="rounded-full transition-opacity hover:opacity-75 focus-visible:outline-2 disabled:opacity-40"
          >
            <Pill status={member.subscribed ? "Subscribed" : "Unsubscribed"} />
          </button>
        </div>

        <div className="w-[112px]">
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
            className="text-muted hover:text-accent flex items-center gap-1.5 font-sans text-[13px] font-medium disabled:opacity-40 disabled:hover:text-current"
          >
            <Icon
              name={member.isAdmin ? "check" : "plus"}
              size={15}
              strokeWidth={1.8}
            />
            {member.isAdmin ? "Admin" : "Make admin"}
          </button>
        </div>

        <div className="text-faint w-[76px] font-sans text-[13px]">
          {joinedLabel(member.createdAt)}
        </div>

        <button
          type="button"
          onClick={remove}
          disabled={pending || isSelf}
          title={isSelf ? "You can’t remove yourself" : "Remove member"}
          aria-label={`Remove ${label}`}
          className="text-faint2 hover:text-warn flex w-[30px] justify-end disabled:opacity-30 disabled:hover:text-current"
        >
          <Icon name="close" size={20} strokeWidth={1.7} />
        </button>
      </div>

      {error && (
        <p className="text-warn mt-1.5 pl-[3.25rem] font-sans text-[13px]">
          {error}
        </p>
      )}
    </div>
  );
}
