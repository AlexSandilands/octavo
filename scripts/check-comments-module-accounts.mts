// check-comments-module.mts, second half: reports, then the account-level
// checks — names on comments, the admin badge, the notification cap, rate
// limits, avatars and both removed-member policies. Run by the main script,
// which owns the fixtures.
import type { CommentsFixtures } from "./fixtures/discussion/comments-module-fixtures.mts";

export async function accountChecks(
  f: CommentsFixtures & { top: string },
): Promise<void> {
  const h = await import("./fixtures/discussion/harness.mts");
  const { as, db, ok, heading, schema, names, thread, moderation, notices } = h;
  const { inbox: reportInbox } = h;
  const { comments, commentReports, memberNames, notifications, users } =
    schema;
  const { eq, and, isNull } = await import("drizzle-orm");
  const { admin, alice, bob, carol, issue, top } = f;
  const { nameFor, aliceName, bobName, adminName, carolName, post, mustPost } =
    f;

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
  let inbox = (await reportInbox.listReports()).rows;
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
  inbox = (await reportInbox.listReports()).rows;
  mine = inbox.find((r) => r.id === reportRows[0]!.id);
  ok(
    mine?.current.state === "deleted" &&
      mine.snapshot.body === "Original words",
    "the report survives the delete with its snapshot",
  );
  ok((await moderation.resolveReport(mine!.id)).ok, "an admin resolves it");
  ok(
    !(await reportInbox.listReports()).rows.some((r) => r.id === mine!.id),
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
    await db.transaction((tx) =>
      notices.notifyReply(tx, inboxOwner.id, row!.id),
    );
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
    lastPost && !lastPost.ok && /posting quickly/.test(lastPost.reason),
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
    lastEdit = await thread.editComment({
      commentId: firstFast,
      body: `e${i}`,
    });
  ok(lastEdit && !lastEdit.ok, "the 31st edit in 10 minutes is slowed down");
  let lastReport:
    | Awaited<ReturnType<typeof moderation.createReport>>
    | undefined;
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
    (await names.setNameAvatar({ nameId: avatarName, imageId: first.id })).ok,
    "re-setting the name's own current avatar is fine",
  );
  const otherOwner = await h.scratchUser({ name: "Other Member" });
  const otherName = await nameFor(otherOwner, "Other Member");
  ok(
    !(await names.setNameAvatar({ nameId: otherName, imageId: first.id })).ok,
    "another name's avatar is refused",
  );
  const logoImage = await h.scratchImage();
  await db
    .insert(schema.logos)
    .values({ name: "check-299 logo", imageId: logoImage.id });
  ok(
    !(await names.setNameAvatar({ nameId: otherName, imageId: logoImage.id }))
      .ok,
    "a logo's image is refused",
  );
  ok(await h.objectExists(logoImage.key), "…and the logo keeps its image");
  as(avatarOwner);
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
}
