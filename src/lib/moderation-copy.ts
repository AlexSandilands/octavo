// What an admin is told when moderating a comment (issue #302), the same in
// the reports inbox and in the thread.

export const DELETE_COMMENT = {
  title: "Delete this comment?",
  body: "Members won’t see it again, and its open reports are resolved. If it has replies they stay, under “Comment removed”.",
  confirm: "Delete comment",
} as const;

export const COMMENT_SHOWN = "Comment shown again.";
