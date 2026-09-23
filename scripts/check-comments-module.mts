// The discussion module (issue #299), in-process against the local database:
// the write refusals, what members and admins read, notifications, reports,
// both removed-member policies and avatar cleanup. Every row it creates is
// removed and the settings row is restored as it was found.
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/check-comments-module.mts
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// requireMember() with the real session module, signed out, in a child process
// so demo mode (a build-time constant) can be switched per run.
if (process.argv.includes("--session-probe")) {
  const session = await import("../src/server/session.ts");
  // Outside demo mode a signed-out visitor is redirected, which throws here.
  const visitor = await session
    .requireMemberOrRedirect("/read/1")
    .catch(() => "redirected");
  let threw = false;
  try {
    await session.requireMember();
  } catch {
    threw = true;
  }
  console.log(JSON.stringify({ visitor, threw }));
  process.exit(0);
}

const probe = (demo: boolean) => {
  const out = execFileSync(
    process.execPath,
    [...process.execArgv, fileURLToPath(import.meta.url), "--session-probe"],
    {
      env: { ...process.env, NEXT_PUBLIC_DEMO_MODE: demo ? "1" : "" },
      stdio: ["ignore", "pipe", "ignore"],
    },
  ).toString();
  return JSON.parse(out.trim().split("\n").at(-1)!) as {
    visitor: unknown;
    threw: boolean;
  };
};

const h = await import("./fixtures/discussion/harness.mts");
const { as, db, ok, heading, schema, names, thread, moderation, notices } = h;
const { comments } = schema;
const { eq } = await import("drizzle-orm");

heading("requireMember()");
const demo = probe(true);
ok(
  demo.visitor === null,
  "demo mode: the signed-out visitor is let through as null",
);
ok(demo.threw, "demo mode: requireMember() still throws for that null visitor");
const signedOut = probe(false);
ok(
  signedOut.visitor === "redirected",
  "signed out: the member page gate redirects",
);
ok(signedOut.threw, "signed out: requireMember() throws");
as(null);
let guarded = false;
try {
  await thread.createComment({ issueId: "x", body: "x", nameId: "x" });
} catch {
  guarded = true;
}
ok(guarded, "a module write with no session throws before doing anything");

heading("every write is guarded (source)");
const writes: Record<string, string[]> = {
  "src/server/comments.ts": [
    "createComment",
    "editComment",
    "deleteOwnComment",
  ],
  "src/server/comment-moderation.ts": [
    "deleteComment",
    "createReport",
    "resolveReport",
  ],
  "src/server/report-inbox.ts": ["listReports", "countOpenReports"],
  "src/server/member-names.ts": [
    "listMyNames",
    "addName",
    "renameName",
    "removeName",
    "setNameAvatar",
    "clearNameAvatar",
    "setNameBadge",
  ],
  "src/server/member-name-moderation.ts": [
    "adminRenameName",
    "adminRetireName",
    "clearAvatar",
  ],
  "src/server/notifications.ts": ["markRead", "markAllRead"],
};
for (const [file, fns] of Object.entries(writes)) {
  const src = readFileSync(file, "utf8");
  for (const fn of fns) {
    const start = src.indexOf(`export async function ${fn}(`);
    const bodyStart = src.indexOf("{\n", src.indexOf(")", start));
    const firstLine = src.slice(bodyStart, bodyStart + 80).split("\n")[1] ?? "";
    ok(
      start >= 0 && /await require(Member|Admin)\(\)/.test(firstLine),
      `${fn} calls requireMember/requireAdmin first`,
    );
  }
}
const setHidden = readFileSync("src/server/comment-moderation.ts", "utf8");
ok(
  /async function setHidden[^{]*\{\n\s*(const \w+ = )?await requireAdmin\(\)/.test(
    setHidden,
  ),
  "hideComment/unhideComment (via setHidden) call requireAdmin first",
);

// ── fixtures ────────────────────────────────────────────────────────────────
const f = await import("./fixtures/discussion/comments-module-fixtures.mts");
const { admin, alice, bob, carol, issue, draft } = f;
const { nameFor, aliceName, bobName, carolName, post, mustPost } = f;

heading("the switch");
await h.withoutSettingsRow(async () => {
  const noRow = await post(carol, {
    issueId: issue.id,
    body: "hello",
    nameId: carolName,
  });
  ok(
    !noRow.ok && /turned off/.test(noRow.reason),
    "refused with no settings row (off is the default)",
  );
});
await h.setSettings({ commentsEnabled: null });
const nullRow = await post(carol, {
  issueId: issue.id,
  body: "hi",
  nameId: carolName,
});
ok(!nullRow.ok, "refused while comments_enabled is NULL");
await h.setSettings({ commentsEnabled: false });
const offRow = await post(carol, {
  issueId: issue.id,
  body: "hi",
  nameId: carolName,
});
ok(!offRow.ok, "refused while comments_enabled is false");
as({ ...alice });
ok(
  (await thread.listComments(issue.id, { id: alice.id, isAdmin: false }))
    .entries.length === 0 &&
    Object.keys(await thread.countComments([issue.id])).length === 0,
  "members read nothing and no counts while off",
);
await h.setSettings({ commentsEnabled: true });

heading("post refusals");
const onDraft = await post(carol, {
  issueId: draft.id,
  body: "hi",
  nameId: carolName,
});
ok(!onDraft.ok && /published/.test(onDraft.reason), "refused on a draft");
const othersName = await post(carol, {
  issueId: issue.id,
  body: "hi",
  nameId: bobName,
});
ok(!othersName.ok, "refused under another account's name");
const carolSpare = await nameFor(carol, "Carol Spare");
as(admin);
await names.adminRetireName(carolSpare);
const retired = await post(carol, {
  issueId: issue.id,
  body: "hi",
  nameId: carolSpare,
});
ok(!retired.ok, "refused under a retired name");
const blank = await post(carol, {
  issueId: issue.id,
  body: "  \n ",
  nameId: carolName,
});
ok(!blank.ok, "a blank body is refused");
const long = await post(carol, {
  issueId: issue.id,
  body: "x".repeat(2001),
  nameId: carolName,
});
ok(!long.ok, "a 2,001-character body is refused");
const badPage = await post(carol, {
  issueId: issue.id,
  body: "hi",
  nameId: carolName,
  pageId: "not-a-page",
});
ok(!badPage.ok, "a pageId not in the issue is refused");

heading("posting, replies, notifications");
const top = await mustPost(alice, {
  issueId: issue.id,
  body: "  First!\r\nSecond line\u0007 ",
  nameId: aliceName,
  pageId: issue.pageIds[1],
});
const [stored] = await db.select().from(comments).where(eq(comments.id, top));
ok(
  stored?.body === "First!\nSecond line",
  "the body is stored as plain, cleaned text",
);
ok(
  stored?.pageId === issue.pageIds[1],
  "the page tag is stored as the page id",
);
const reply = await mustPost(bob, {
  issueId: issue.id,
  parentId: top,
  body: "A reply",
  nameId: bobName,
});
const replyToReply = await post(carol, {
  issueId: issue.id,
  parentId: reply,
  body: "deeper",
  nameId: carolName,
});
ok(
  !replyToReply.ok && /reply to a reply/.test(replyToReply.reason),
  "a reply to a reply is refused",
);
await mustPost(alice, {
  issueId: issue.id,
  parentId: top,
  body: "self",
  nameId: aliceName,
});
as(alice);
const aliceNotes = await notices.listNotifications(alice.id);
ok(
  aliceNotes.length === 1 && aliceNotes[0]!.commentId === reply,
  "a reply notifies the parent's author",
);
ok(
  aliceNotes[0]?.replierName === "Bob Bee",
  "…naming the replier's posting name",
);
ok(
  (await notices.listNotifications(bob.id)).length === 0,
  "the replier is not notified",
);
ok((await notices.countUnread(alice.id)) === 1, "one unread");
await notices.markAllRead();
ok((await notices.countUnread(alice.id)) === 0, "markAllRead clears it");

heading("the member's read shape");
const memberThread = await thread.listComments(issue.id, {
  id: bob.id,
  isAdmin: false,
});
const entry = memberThread.entries[0];
ok(
  memberThread.viewer === "member" && entry && !entry.removed,
  "a member gets the member shape",
);
const keys = new Set(
  memberThread.entries.flatMap((e) => [
    ...Object.keys(e),
    ...e.replies.flatMap((r) => Object.keys(r)),
  ]),
);
ok(
  !["email", "authorId", "userId", "account", "accountName"].some((k) =>
    keys.has(k),
  ),
  `no email or author id at runtime either (${[...keys].sort().join(", ")})`,
);
ok(
  entry && !entry.removed && !entry.isMine && entry.replies[0]?.isMine === true,
  "isMine is computed for the viewer",
);
ok(
  (
    await thread.listComments(
      issue.id,
      { id: bob.id, isAdmin: false },
      { pageIds: [issue.pageIds[0]!] },
    )
  ).entries.length === 0,
  "the page filter keeps only comments tagged to those pages",
);
ok(
  (await thread.countComments([issue.id]))[issue.id] === 3,
  "countComments counts visible comments and replies",
);
ok(
  (await thread.listComments(issue.id, null)).entries.length === 0,
  "a null viewer gets nothing",
);

heading("edit");
as(bob);
ok(
  !(await thread.editComment({ commentId: top, body: "hijack" })).ok,
  "only the author can edit",
);
as(alice);
ok(
  (await thread.editComment({ commentId: top, body: "First, edited" })).ok,
  "the author edits",
);
const edited = (
  await thread.listComments(issue.id, { id: bob.id, isAdmin: false })
).entries[0];
ok(
  edited &&
    !edited.removed &&
    edited.editedAt !== null &&
    edited.body === "First, edited",
  "…and it shows as edited",
);

heading("hidden and deleted comments");
// Two threads, each a top-level comment with one reply; one hidden by an
// admin, one deleted by its author. Plus two lone comments, likewise.
const hiddenTop = await mustPost(alice, {
  issueId: issue.id,
  body: "to hide",
  nameId: aliceName,
});
await mustPost(bob, {
  issueId: issue.id,
  parentId: hiddenTop,
  body: "r1",
  nameId: bobName,
});
const deletedTop = await mustPost(alice, {
  issueId: issue.id,
  body: "to delete",
  nameId: aliceName,
});
await mustPost(bob, {
  issueId: issue.id,
  parentId: deletedTop,
  body: "r2",
  nameId: bobName,
});
const loneHidden = await mustPost(alice, {
  issueId: issue.id,
  body: "lone hide",
  nameId: aliceName,
});
const loneDeleted = await mustPost(alice, {
  issueId: issue.id,
  body: "lone delete",
  nameId: aliceName,
});
as(admin);
await moderation.hideComment(hiddenTop);
await moderation.hideComment(loneHidden);
as(alice);
await thread.deleteOwnComment(deletedTop);
await thread.deleteOwnComment(loneDeleted);

const seen = await thread.listComments(issue.id, {
  id: bob.id,
  isAdmin: false,
});
const stubOf = (id: string) => seen.entries.find((e) => e.id === id);
const hiddenStub = stubOf(hiddenTop);
const deletedStub = stubOf(deletedTop);
const shape = (e: typeof hiddenStub) =>
  e
    ? JSON.stringify(Object.keys(e).sort()) +
      JSON.stringify({ removed: e.removed, replies: e.replies.length })
    : "missing";
ok(
  hiddenStub?.removed === true && deletedStub?.removed === true,
  "both come back to a member as stubs",
);
ok(
  shape(hiddenStub) === shape(deletedStub),
  "…identical in shape — hidden and deleted can't be told apart",
);
ok(
  hiddenStub && !("body" in hiddenStub) && !("name" in hiddenStub),
  "a stub carries no body and no author",
);
ok(
  !stubOf(loneHidden) && !stubOf(loneDeleted),
  "without replies both are omitted",
);
const [softRow] = await db
  .select()
  .from(comments)
  .where(eq(comments.id, deletedTop));
ok(
  softRow?.deletedAt && softRow.body === "",
  "a deleted comment with replies is soft-deleted with its body blanked",
);
ok(
  (await db.select().from(comments).where(eq(comments.id, loneDeleted)))
    .length === 0,
  "a deleted comment with no replies or reports is hard-deleted",
);
const adminThread = await thread.listComments(issue.id, {
  id: admin.id,
  isAdmin: true,
});
const adminEntry = (id: string) =>
  adminThread.viewer === "admin"
    ? adminThread.entries.find((e) => e.id === id)
    : undefined;
ok(
  adminEntry(hiddenTop)?.hidden === true &&
    adminEntry(hiddenTop)?.body === "to hide",
  "an admin sees the hidden comment flagged, with its body",
);
ok(
  adminEntry(deletedTop)?.deleted === true,
  "an admin sees the deleted stub flagged",
);
ok(
  adminEntry(loneHidden)?.hidden === true,
  "an admin sees a hidden comment even without replies",
);
ok(
  adminEntry(top)?.account?.name === "Alice Check",
  "an admin sees the account (users.name) behind the name",
);
const replyOnHidden = await post(bob, {
  issueId: issue.id,
  parentId: hiddenTop,
  body: "x",
  nameId: bobName,
});
ok(!replyOnHidden.ok, "replying to a hidden comment is refused");
as(alice);
const hiddenEdit = await thread.editComment({
  commentId: loneHidden,
  body: "rewritten under the hide",
});
ok(
  !hiddenEdit.ok && hiddenEdit.reason === "That comment has been removed.",
  "the author can't edit a hidden comment",
);
as(admin);
await moderation.unhideComment(loneHidden);
as(alice);
ok(
  (await thread.editComment({ commentId: loneHidden, body: "lone, revised" }))
    .ok,
  "…and can again once it is unhidden",
);
ok(
  (
    await thread.listComments(issue.id, { id: bob.id, isAdmin: false })
  ).entries.some((e) => e.id === loneHidden),
  "unhide brings it back",
);

const { accountChecks } = await import("./check-comments-module-accounts.mts");
await accountChecks({ ...f, top });

await h.finish();
