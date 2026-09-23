import type { NotificationView } from "@/lib/comments";

// What the library header's bell shows for each notification (issue #303),
// built on the server and handed to the client menu as plain data.

/** How many the bell's menu lists; the count covers them all. */
export const BELL_LIMIT = 20;

export type BellItem = {
  id: string;
  /** The #301 deep link: the thread opens on the reply. */
  href: string;
  /** "Ada replied to your comment on Issue 14". */
  text: string;
  createdAt: string;
  read: boolean;
};

/** A shared account (more than one posting name) is told whose comment was
 *  replied to; anyone else reads "your comment". */
export function toBellItems(
  notes: NotificationView[],
  shared: boolean,
): BellItem[] {
  return notes.flatMap((n) =>
    n.issueNumber === null
      ? []
      : [
          {
            id: n.id,
            href: `/read/${n.issueNumber}?discussion=1&comment=${encodeURIComponent(n.commentId)}`,
            text: `${n.replierName} replied to ${shared ? `${n.parentName}’s` : "your"} comment on Issue ${n.issueNumber}`,
            createdAt: n.createdAt.toISOString(),
            read: n.read,
          },
        ],
  );
}

/** The bell's accessible name: "Notifications, 3 unread". */
export function bellLabel(unread: number): string {
  return unread > 0 ? `Notifications, ${unread} unread` : "Notifications";
}
