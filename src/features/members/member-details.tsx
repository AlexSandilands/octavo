import { Button, Icon } from "@/components/ui";
import { MemberNotes } from "./member-notes-disclosure";
import styles from "./members-layout.module.css";
import type { MemberRow as Member } from "@/server/users";

export function MemberDetails({
  id,
  member,
  label,
  pending,
  isSelf,
  onToggleAdmin,
  onEdit,
  onPostingNames,
  onRemove,
}: {
  id: string;
  member: Member;
  label: string;
  pending: boolean;
  isSelf: boolean;
  onToggleAdmin: () => void;
  onEdit: () => void;
  /** Opens the posting-names dialog; absent while the member has none. */
  onPostingNames?: () => void;
  onRemove: () => void;
}) {
  const joined = new Date(member.createdAt).toLocaleDateString("en-NZ", {
    month: "short",
    year: "numeric",
  });

  return (
    <div id={id} className={styles.details} data-member-details>
      <div
        className={styles.notes}
        data-member-cell="notes"
        data-empty={!member.notes?.trim()}
      >
        <span className={styles.fieldLabel}>Notes</span>
        <MemberNotes notes={member.notes} label={label} />
      </div>
      <div data-member-cell="role">
        <span className={styles.fieldLabel}>Role</span>
        <span
          className={`${styles.roleState} text-muted font-sans text-[13px] font-semibold`}
        >
          {member.isAdmin ? "Admin" : "Member"}
        </span>
        <button
          type="button"
          onClick={onToggleAdmin}
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
          {member.isAdmin ? (
            <>
              <span className={styles.compactOnly}>Remove admin</span>
              <span className={styles.wideOnly}>Admin</span>
            </>
          ) : (
            "Make admin"
          )}
        </button>
      </div>
      <div
        className="text-faint font-sans text-[13px]"
        data-member-cell="joined"
      >
        <span className={styles.fieldLabel}>Joined</span>
        <span className="inline-flex min-h-11 items-center">{joined}</span>
      </div>
      <div className={styles.actions} data-member-cell="actions">
        <Button
          icon="pencil"
          iconPosition="left"
          variant="secondary"
          size="sm"
          aria-label={`Edit ${label}`}
          title="Edit member details"
          onClick={onEdit}
          disabled={pending}
          className={styles.rowAction}
        >
          <span className={styles.compactOnly}>Edit</span>
        </Button>
        {onPostingNames && (
          <Button
            icon="users"
            iconPosition="left"
            variant="secondary"
            size="sm"
            aria-label={`Posting names for ${label}`}
            title="Posting names…"
            onClick={onPostingNames}
            disabled={pending}
            className={styles.rowAction}
          >
            <span className={styles.compactOnly}>Posting names…</span>
          </Button>
        )}
        <Button
          icon="close"
          iconPosition="left"
          variant="secondary"
          size="sm"
          aria-label={`Remove ${label}`}
          title={isSelf ? "You can’t remove yourself" : "Remove member"}
          onClick={onRemove}
          disabled={pending || isSelf}
          className={`${styles.rowAction} enabled:hover:text-warn`}
        >
          <span className={styles.compactOnly}>Remove</span>
        </Button>
      </div>
    </div>
  );
}
