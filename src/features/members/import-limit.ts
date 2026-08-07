// The most members one CSV import may carry. The club is ~1000 members, so a
// five-figure file is a malformed export or an abuse attempt, not a real list.
// Both ends enforce it: the preview says so plainly and holds the import back
// before the admin commits, and the server action still refuses an oversized
// batch. A cap only the server knew about surfaced as the generic "please try
// again", which an admin could only retry into forever (#124). Plain module (no
// directive): imported by both the server action and the client dialog.
export const MEMBERS_IMPORT_MAX = 5000;
