import { Avatar } from "@/components/ui";
import type { ThreadComment } from "@/lib/discussion-thread";
import { initials } from "@/lib/initials";
import { AdminBadge } from "./admin-badge";
import { fullDate, relativeTime } from "./relative-time";

// Who wrote a comment and when (issue #301). A removed member's comment gets a
// blank disc rather than initials — there is no name left to take them from.
export function CommentMeta({
  comment,
  now,
  reply,
}: {
  comment: ThreadComment;
  now: number;
  reply: boolean;
}) {
  const size = reply ? "sm" : "md";
  return (
    <div className="flex items-start gap-2.5">
      {comment.former ? (
        <span
          aria-hidden
          className={`bg-chip flex-none rounded-full ${reply ? "h-7 w-7" : "h-9 w-9"}`}
        />
      ) : (
        <Avatar
          initials={initials(comment.name)}
          src={comment.avatarUrl}
          size={size}
        />
      )}
      <div className="min-w-0 flex-1 font-sans leading-snug">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span
            className={`font-semibold ${comment.former ? "text-muted italic" : "text-ink"} text-[15px]`}
          >
            {comment.name}
          </span>
          {comment.badge && <AdminBadge />}
          <time
            dateTime={comment.createdAt}
            title={fullDate(comment.createdAt)}
            className="text-faint text-[13px]"
          >
            {relativeTime(comment.createdAt, now)}
          </time>
          {comment.editedAt && (
            <span
              className="text-faint text-[13px]"
              title={`Edited ${fullDate(comment.editedAt)}`}
            >
              (edited)
            </span>
          )}
        </div>
        {/* Admins always see the account behind a name (epic #298). */}
        {comment.account !== undefined && comment.account !== null && (
          <p className="text-faint mt-0.5 text-[13px]">
            Account: {comment.account.name?.trim() || "no name on record"}
          </p>
        )}
      </div>
    </div>
  );
}
