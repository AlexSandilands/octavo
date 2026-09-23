"use client";

import { useId, useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { MemberDialog } from "./member-dialog";
import { SelectCheckbox } from "@/components/select-checkbox";
import { Avatar, IconButton, Pill } from "@/components/ui";
import { MemberDetails } from "./member-details";
import { PostingNamesDialog } from "./posting-names-dialog";
import { RemovalCommentsNote } from "./removal-comments-note";
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
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [namesOpen, setNamesOpen] = useState(false);
  const postingNames = member.postingNames ?? [];
  const liveNames = postingNames.filter((n) => !n.retired);
  // The pending destructive action awaiting confirmation, if any.
  const [confirm, setConfirm] = useState<{
    title: string;
    body: React.ReactNode;
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
      body: (
        <>
          This revokes their access and signs them out. It can’t be undone.
          <RemovalCommentsNote ids={[member.id]} many={false} />
        </>
      ),
      confirmLabel: "Remove member",
      confirmIcon: "trash",
      act: () => run(() => removeMemberAction(member.id)),
    });
  };

  return (
    <div
      className="members-row border-line-soft border-b py-3"
      data-expanded={expanded}
    >
      <div className={styles.grid}>
        <div className={styles.identity}>
          <SelectCheckbox
            checked={selected}
            onChange={(next) => onSelect(member.id, next)}
            label={`Select ${label}`}
          />
          <span className={styles.avatar}>
            <Avatar initials={initials(label)} />
          </span>
          <div className={styles.identityText} data-member-cell="identity">
            <div className="text-ink font-sans text-[15px] font-semibold">
              {member.name ?? "—"}
            </div>
            <div className="text-faint font-sans text-[13px]">
              {member.email}
            </div>
            {liveNames.length > 0 && (
              <div
                className="text-muted font-sans text-[13px]"
                data-member-posting-names
              >
                Posts as {liveNames.map((n) => n.name).join(", ")}
              </div>
            )}
          </div>
        </div>

        <div className={styles.subscription} data-member-cell="subscription">
          <span className="sr-only">Subscription</span>
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

        <span className={styles.detailsToggle} data-member-details-toggle>
          <IconButton
            icon="chevronDown"
            size={18}
            label={`${expanded ? "Hide" : "Show"} details for ${label}`}
            aria-expanded={expanded}
            aria-controls={detailsId}
            onClick={() => setExpanded((current) => !current)}
          />
        </span>
        <MemberDetails
          id={detailsId}
          member={member}
          label={label}
          pending={pending}
          isSelf={isSelf}
          onToggleAdmin={toggleAdmin}
          onEdit={() => setEditing(true)}
          onPostingNames={
            postingNames.length > 0 ? () => setNamesOpen(true) : undefined
          }
          onRemove={remove}
        />
      </div>

      {error && (
        <p className="text-warn mt-1.5 px-1.5 font-sans text-[13px]">{error}</p>
      )}

      {editing && (
        <MemberDialog member={member} onClose={() => setEditing(false)} />
      )}

      {namesOpen && (
        <PostingNamesDialog
          label={label}
          names={postingNames}
          onClose={() => setNamesOpen(false)}
        />
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
