// The discussion module (issue #299), in-process against the local database:
// the write refusals, what members and admins read, notifications, reports,
// both removed-member policies and avatar cleanup. Every row it creates is
// removed and the settings row is restored as it was found.
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/check-comments-module.mts
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Scratch } from "./fixtures/discussion/harness.mts";

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
const { comments, notifications, commentReports, memberNames, users } = schema;
const { eq, and, isNull } = await import("drizzle-orm");

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
    "listReports",
    "resolveReport",
  ],
  "src/server/member-names.ts": [
    "listMyNames",
    "addName",
    "renameName",
    "removeName",
    "setNameAvatar",
    "clearNameAvatar",
    "setNameBadge",
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
  /async function setHidden[^{]*\{\n\s*await requireAdmin\(\)/.test(setHidden),
  "hideComment/unhideComment (via setHidden) call requireAdmin first",
);

// ── fixtures ────────────────────────────────────────────────────────────────
const admin = await h.scratchUser({ name: "Check Admin", isAdmin: true });
const alice = await h.scratchUser({ name: "Alice Check" });
const bob = await h.scratchUser({ name: "Bob Check" });
// Takes the refused posts and the policy replies, so no one member's post
// budget runs out mid-check.
const carol = await h.scratchUser({ name: "Carol Check" });
const issue = await h.scratchIssue(true);
const draft = await h.scratchIssue(false);

async function nameFor(user: Scratch, name: string) {
  as(user);
  const result = await names.addName({ name });
  if (!result.ok) throw new Error(`addName ${name}: ${result.reason}`);
  return result.name.id;
}
const aliceName = await nameFor(alice, "Alice Aye");
const bobName = await nameFor(bob, "Bob Bee");
const adminName = await nameFor(admin, "Chair Person");
const carolName = await nameFor(carol, "Carol Sea");

async function post(
  user: Scratch,
  input: Parameters<typeof thread.createComment>[0],
) {
  as(user);
  return thread.createComment(input);
}
async function mustPost(
  user: Scratch,
  input: Parameters<typeof thread.createComment>[0],
) {
  const result = await post(user, input);
  if (!result.ok) throw new Error(`post: ${result.reason}`);
  return result.id;
}

heading("the switch");
await h.withoutSettingsRow(async () => {
  const noRow = await post(carol, {
    issueId: issue.id,
    body: "hello",
    nameId: carolName,
  });
  ok(
    !noRow.ok && /switched off/.test(noRow.reason),
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
as(admin);
await moderation.unhideComment(loneHidden);
ok(
  (
    await thread.listComments(issue.id, { id: bob.id, isAdmin: false })
  ).entries.some((e) => e.id === loneHidden),
  "unhide brings it back",
);

heading("reports");
const reported = await mustPost(alice, {
  issueId: issue.id,
  body: "Original words",
  nameId: aliceName,
});
as(bob);
ok(
  (
    await moderation.createReport({
      commentId: reported,
      reason: "offensive",
      note: "Not nice",
    })
  ).ok,
  "a report says thanks",
);
ok(
  (await moderation.createReport({ commentId: reported, reason: "spam" })).ok,
  "a second report by the same member still says thanks",
);
as(alice);
ok(
  (await moderation.createReport({ commentId: reported, reason: "spam" })).ok,
  "reporting your own comment says thanks",
);
const reportRows = await db
  .select()
  .from(commentReports)
  .where(eq(commentReports.issueId, issue.id));
ok(reportRows.length === 1, "…but only the one report was written");
ok(
  reportRows[0]?.snapshotBody === "Original words" &&
    reportRows[0]?.snapshotName === "Alice Aye",
  "the report snapshots the body and the posting name",
);
await thread.editComment({ commentId: reported, body: "Softened words" });
as(admin);
let inbox = await moderation.listReports();
let mine = inbox.find((r) => r.id === reportRows[0]!.id);
ok(
  mine?.current.state === "edited" && mine.snapshot.body === "Original words",
  "after an edit the inbox shows the snapshot and 'edited since'",
);
ok(mine?.snapshot.account?.id === alice.id, "the snapshot names the account");
as(alice);
await thread.deleteOwnComment(reported);
const [reportedRow] = await db
  .select()
  .from(comments)
  .where(eq(comments.id, reported));
ok(
  reportedRow?.deletedAt && reportedRow.body === "",
  "a reported comment is soft-deleted, not hard-deleted",
);
as(admin);
inbox = await moderation.listReports();
mine = inbox.find((r) => r.id === reportRows[0]!.id);
ok(
  mine?.current.state === "deleted" && mine.snapshot.body === "Original words",
  "the report survives the delete with its snapshot",
);
ok((await moderation.resolveReport(mine!.id)).ok, "an admin resolves it");
ok(
  !(await moderation.listReports()).some((r) => r.id === mine!.id),
  "…and it leaves the open inbox",
);

heading("names on comments");
const renamed = await mustPost(bob, {
  issueId: issue.id,
  body: "Signed",
  nameId: bobName,
});
as(bob);
await names.renameName({ nameId: bobName, name: "Robert Bee" });
const afterRename = (
  await thread.listComments(issue.id, { id: alice.id, isAdmin: false })
).entries.find((e) => e.id === renamed);
ok(
  afterRename && !afterRename.removed && afterRename.name === "Robert Bee",
  "renaming shows on old comments",
);
await names.addName({ name: "Bobby" });
const removedName = await names.removeName(bobName);
ok(
  removedName.ok && removedName.outcome === "retired",
  "removing a name with comments retires it",
);
const [bobRow] = await db
  .select()
  .from(memberNames)
  .where(eq(memberNames.id, bobName));
ok(bobRow?.retiredAt !== null, "…the row is kept, retired");
const keptOnComment = (
  await thread.listComments(issue.id, { id: alice.id, isAdmin: false })
).entries.find((e) => e.id === renamed);
ok(
  keptOnComment &&
    !keptOnComment.removed &&
    keptOnComment.name === "Robert Bee",
  "…and still shown on its comments",
);
const lastOne = await h.scratchUser({ name: "Solo Member" });
const soloName = await nameFor(lastOne, "Solo Name");
ok(
  !(await names.removeName(soloName)).ok,
  "the last live name can't be removed",
);

heading("the admin badge");
as(admin);
await names.setNameBadge({ nameId: adminName, badge: true });
const badged = await mustPost(admin, {
  issueId: issue.id,
  body: "Official",
  nameId: adminName,
});
const badgeOf = async () => {
  const e = (
    await thread.listComments(issue.id, { id: alice.id, isAdmin: false })
  ).entries.find((x) => x.id === badged);
  return e && !e.removed ? e.badge : undefined;
};
ok((await badgeOf()) === true, "a badged admin name shows the badge");
as(alice);
ok(
  !(
    await names
      .setNameBadge({ nameId: aliceName, badge: true })
      .catch(() => ({ ok: false }))
  ).ok,
  "a member can't badge a name",
);
await db.update(users).set({ isAdmin: false }).where(eq(users.id, admin.id));
ok(
  (await badgeOf()) === false,
  "the badge disappears when the account loses admin",
);
await db.update(users).set({ isAdmin: true }).where(eq(users.id, admin.id));

heading("the 101st notification trims the oldest");
const inboxOwner = await h.scratchUser({ name: "Busy Poster" });
const ownerName = await nameFor(inboxOwner, "Busy Poster");
const parent = await mustPost(inboxOwner, {
  issueId: issue.id,
  body: "Popular",
  nameId: ownerName,
});
const replyIds: string[] = [];
for (let i = 0; i < 101; i++) {
  const [row] = await db
    .insert(comments)
    .values({
      issueId: issue.id,
      parentId: parent,
      authorId: bob.id,
      body: `r${i}`,
    })
    .returning({ id: comments.id });
  await db.transaction((tx) => notices.notifyReply(tx, inboxOwner.id, row!.id));
  replyIds.push(row!.id);
}
const kept = await db
  .select({ commentId: notifications.commentId })
  .from(notifications)
  .where(eq(notifications.userId, inboxOwner.id));
ok(kept.length === 100, `100 kept (${kept.length})`);
ok(!kept.some((n) => n.commentId === replyIds[0]), "the oldest was trimmed");
ok(
  kept.some((n) => n.commentId === replyIds[100]),
  "the newest is kept",
);
as(admin);
await moderation.hideComment(replyIds[100]!);
ok(
  (await notices.countUnread(inboxOwner.id)) === 99,
  "a hidden reply's notification stops counting",
);

heading("rate limits");
const fast = await h.scratchUser({ name: "Fast Poster" });
const fastName = await nameFor(fast, "Fast Poster");
let lastPost: Awaited<ReturnType<typeof thread.createComment>> | undefined;
for (let i = 0; i < 11; i++) {
  lastPost = await post(fast, {
    issueId: issue.id,
    body: `n${i}`,
    nameId: fastName,
  });
}
ok(
  lastPost && !lastPost.ok && /going a little fast/.test(lastPost.reason),
  "the 11th post in 10 minutes is slowed down",
);
as(fast);
const firstFast = (
  await db
    .select({ id: comments.id })
    .from(comments)
    .where(and(eq(comments.authorId, fast.id), isNull(comments.parentId)))
)[0]!.id;
let lastEdit: Awaited<ReturnType<typeof thread.editComment>> | undefined;
for (let i = 0; i < 31; i++)
  lastEdit = await thread.editComment({ commentId: firstFast, body: `e${i}` });
ok(lastEdit && !lastEdit.ok, "the 31st edit in 10 minutes is slowed down");
let lastReport: Awaited<ReturnType<typeof moderation.createReport>> | undefined;
for (let i = 0; i < 11; i++)
  lastReport = await moderation.createReport({
    commentId: top,
    reason: "spam",
  });
ok(lastReport && !lastReport.ok, "the 11th report in an hour is slowed down");

heading("avatars");
const avatarOwner = await h.scratchUser({ name: "Avatar Member" });
const avatarName = await nameFor(avatarOwner, "Avatar Member");
const first = await h.scratchImage();
const second = await h.scratchImage();
as(avatarOwner);
ok(
  (await names.setNameAvatar({ nameId: avatarName, imageId: first.id })).ok,
  "an avatar is set",
);
const survived = await db.transaction((tx) =>
  h.assets.takeOrphanedImages(tx, [first.id]),
);
await h.assets.sweepOrphanedObjects({ keys: survived, context: {} });
ok(
  survived.length === 0 && (await h.objectExists(first.key)),
  "an avatar survives the orphan sweep",
);
ok(
  (await names.setNameAvatar({ nameId: avatarName, imageId: second.id })).ok,
  "the avatar is replaced",
);
ok(
  !(await h.objectExists(first.key)),
  "…the old image's object is gone in the same step",
);
ok(
  (await names.listMyNames())[0]?.avatarUrl?.includes(
    second.key.split("/").at(-1)!,
  ),
  "the new avatar resolves to a URL",
);
as(admin);
ok(
  (await moderation.hideComment("nope")).ok === false,
  "moderating a missing comment is refused",
);
ok((await names.clearAvatar(avatarName)).ok, "an admin clears any avatar");
ok(!(await h.objectExists(second.key)), "…and its object is gone");

heading("removed-member policies");
async function memberWithThread(label: string) {
  const member = await h.scratchUser({ name: `${label} Leaver` });
  const nameId = await nameFor(member, `${label} Leaver`);
  const image = await h.scratchImage();
  as(member);
  await names.setNameAvatar({ nameId, imageId: image.id });
  const withReply = await mustPost(member, {
    issueId: issue.id,
    body: `${label} replied-to`,
    nameId,
  });
  await mustPost(carol, {
    issueId: issue.id,
    parentId: withReply,
    body: `${label} carol reply`,
    nameId: carolName,
  });
  const lone = await mustPost(member, {
    issueId: issue.id,
    body: `${label} lone`,
    nameId,
  });
  const theirReply = await mustPost(member, {
    issueId: issue.id,
    parentId: top,
    body: `${label} reply`,
    nameId,
  });
  return { member, image, withReply, lone, theirReply };
}
const rowOf = async (id: string) =>
  (await db.select().from(comments).where(eq(comments.id, id)))[0];

await h.setSettings({ removedMemberComments: "delete" });
const leaverD = await memberWithThread("Delete");
ok(
  (await h.removal.deleteUser(leaverD.member.id, admin.id)).ok,
  "delete policy: the member is removed",
);
const stubD = await rowOf(leaverD.withReply);
ok(
  stubD?.deletedAt && stubD.body === "" && stubD.authorId === null,
  "their comment with a reply is left as a blank stub",
);
ok(
  !(await rowOf(leaverD.lone)) && !(await rowOf(leaverD.theirReply)),
  "their other comments and replies are gone",
);
const viewD = await thread.listComments(issue.id, {
  id: bob.id,
  isAdmin: false,
});
const threadD = viewD.entries.find((e) => e.id === leaverD.withReply);
ok(
  threadD?.removed === true &&
    threadD.replies[0]?.body === "Delete carol reply",
  "…and the other member's reply still reads under it",
);
ok(
  !(await h.objectExists(leaverD.image.key)),
  "delete policy: their avatar object is gone",
);

await h.setSettings({ removedMemberComments: "anonymise" });
const leaverA = await memberWithThread("Anon");
const bulk = await h.removal.deleteUsers([leaverA.member.id], admin.id);
ok(bulk.removed === 1, "anonymise policy: the member is removed (bulk path)");
const viewA = await thread.listComments(issue.id, {
  id: bob.id,
  isAdmin: false,
});
const loneA = viewA.entries.find((e) => e.id === leaverA.lone);
ok(
  loneA &&
    !loneA.removed &&
    loneA.name === "Former member" &&
    loneA.body === "Anon lone",
  'their comments stay as "Former member"',
);
ok(loneA && !loneA.removed && loneA.avatarUrl === null, "…with no avatar");
ok(
  (await rowOf(leaverA.theirReply))?.authorId === null,
  "their replies stay, unattributed",
);
ok(
  !(await h.objectExists(leaverA.image.key)),
  "anonymise policy: their avatar object is gone",
);

await h.finish();
