import Link from "next/link";
import { Avatar, Pill } from "@/components/ui";
import { accountLine, type ThreadComment } from "@/lib/discussion-thread";
import { initials } from "@/lib/initials";
import { AdminBadge } from "./admin-badge";
import { fullDate, relativeTime } from "./relative-time";

// Who wrote a comment and when (issue #301). A removed member's comment gets a
// blank disc rather than initials — there is no name left to take them from.
// An admin also sees its moderation state and, when it differs from the name,
// the account behind it (#302).
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
          {comment.deleted ? (
            <Pill status="Deleted" />
          ) : (
            comment.hidden && <Pill status="Hidden" />
          )}
        </div>
        <AccountLine comment={comment} />
      </div>
    </div>
  );
}

// Never the email: the club's name for the account, linked to the members
// list searched by it (the search matches names; the email stays out of the
// address). An account with no name has nothing to search by.
function AccountLine({ comment }: { comment: ThreadComment }) {
  const account = accountLine(comment);
  if (!account) return null;
  return (
    <p className="text-faint mt-0.5 text-[13px]">
      Account:{" "}
      {account.name ? (
        <Link
          href={`/admin/members?q=${encodeURIComponent(account.name)}`}
          className="text-accent -my-[13px] inline-flex min-h-11 items-center font-medium hover:underline"
        >
          {account.name}
        </Link>
      ) : (
        "no name on record"
      )}
    </p>
  );
}
