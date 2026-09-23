// The reports half of moderation (issue #302), in-process against the local
// database: hiding and deleting resolve a comment's open reports, a report
// emails the admins only when it is new, the 15-minute throttle, escaping, a
// failed send, the inbox's search/filter/paging, the removal confirmation's
// count and a fresh deployment's switch. Scratch rows are prefixed check-302
// and removed; the settings row is restored as found.
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/check-report-moderation.mts
import type { Scratch } from "./fixtures/discussion/harness.mts";

const h = await import("./fixtures/discussion/harness.mts");
h.scratchPrefix("check-302");
const { as, db, ok, heading, schema, names, thread, moderation } = h;
const { inbox, alert, removal } = h;
const { emailLinkOrigin } = await import("../src/server/site-origin.ts");
const { comments, commentReports, users } = schema;
const { eq, inArray } = await import("drizzle-orm");
const { getSettings } = await import("../src/server/settings.ts");
const { reportExcerpt } = await import("../src/server/report-email.ts");
const { sentryCaptures } =
  await import("./fixtures/discussion/sentry-stub.mts");

// ── fixtures ────────────────────────────────────────────────────────────────
const admin = await h.scratchUser({ name: "Check Admin", isAdmin: true });
const alice = await h.scratchUser({ name: "Alice Check" });
const reporters: Scratch[] = [];
for (let i = 0; i < 4; i++) {
  reporters.push(await h.scratchUser({ name: `Reporter ${i} Check` }));
}
const [bob, carol, dave, erin] = reporters as [
  Scratch,
  Scratch,
  Scratch,
  Scratch,
];
const issue = await h.scratchIssue(true);
await h.setSettings({ commentsEnabled: true });

as(alice);
const aliceName = await names.addName({ name: "Alice Aye" });
if (!aliceName.ok) throw new Error(aliceName.reason);

async function post(body: string) {
  as(alice);
  const result = await thread.createComment({
    issueId: issue.id,
    body,
    nameId: aliceName.ok ? aliceName.name.id : "",
  });
  if (!result.ok) throw new Error(`post: ${result.reason}`);
  return result.id;
}
async function report(by: Scratch, commentId: string, reason = "offensive") {
  as(by);
  return moderation.createReport({ commentId, reason, note: null });
}
const reportsOn = (commentId: string) =>
  db
    .select()
    .from(commentReports)
    .where(eq(commentReports.commentId, commentId));

// Every send the module attempts, recorded instead of logged.
type Sent = { to: string; subject: string; html: string; text: string };
const sends: Sent[][] = [];
const record = async (messages: Sent[]) => {
  sends.push(messages);
};
alert.reportAlert.send = record;
const freshWindow = () => {
  alert.reportAlert.lastSentAt = null;
};

heading("a report emails every admin, once, and only when it is new");
freshWindow();
const first = await post("First words");
ok((await report(bob, first)).ok, "the reporter is thanked");
const adminRows = await db
  .select({ email: users.email })
  .from(users)
  .where(eq(users.isAdmin, true));
ok(sends.length === 1, "one send for the new report");
ok(
  sends[0]?.length === adminRows.length &&
    adminRows.every((a) => sends[0]!.some((m) => m.to === a.email)),
  `…addressed to every admin, one message each (${adminRows.length})`,
);
ok(
  sends[0]?.[0]?.text.includes("First words") &&
    sends[0][0].text.includes("Reporter 0 Check") &&
    sends[0][0].text.includes("Offensive") &&
    sends[0][0].html.includes("/admin/reports"),
  "…with the reason, the excerpt, the reporter and the inbox link",
);
freshWindow();
ok((await report(bob, first)).ok, "a duplicate report still says thanks");
ok((await reportsOn(first)).length === 1, "…writes no second row");
ok(sends.length === 1, "…and sends no email (window open, so not throttled)");
as(alice);
ok(
  (await moderation.createReport({ commentId: first, reason: "spam" })).ok,
  "reporting your own comment says thanks",
);
ok(sends.length === 1, "…and sends no email");

heading("the 15-minute throttle");
freshWindow();
const second = await post("Second words");
const third = await post("Third words");
const fourth = await post("Fourth words");
await report(bob, second);
ok(sends.length === 2, "a report with the window clear sends");
await report(carol, third);
ok(sends.length === 2, "a second report inside 15 minutes sends nothing");
ok((await reportsOn(third)).length === 1, "…though its report is recorded");
alert.reportAlert.lastSentAt = Date.now() - alert.REPORT_EMAIL_WINDOW_MS - 1;
await report(dave, fourth);
as(admin);
const open = await inbox.countOpenReports();
ok(sends.length === 3, "the next report after the window sends");
ok(
  open > 1 && sends[2]?.[0]?.subject.includes(`${open} open reports`),
  `…and says "${open} open reports"`,
);
ok(
  sends[2]?.[0]?.text.includes(`${open} open reports are waiting`),
  "…in the body too",
);

heading("member text arrives escaped");
freshWindow();
const nasty = await post('<script>alert("x")</script> & <b>bold</b>');
await report(erin, nasty);
const html = sends.at(-1)?.[0]?.html ?? "";
ok(
  html.includes("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;") &&
    !html.includes("<script>") &&
    !html.includes("<b>bold"),
  "a <script> body is HTML-escaped in the email",
);
ok(
  reportExcerpt("a\u0007b\u001bc\nd") === "a b c d",
  "control characters and newlines are stripped from the excerpt",
);
const long = reportExcerpt("x".repeat(500));
ok(
  [...long].length === 201 && long.endsWith("…"),
  "the excerpt is cut at 200 characters",
);

heading("a failed send never fails the report");
freshWindow();
alert.reportAlert.send = async () => {
  throw new Error("Resend is down");
};
const fifth = await post("Fifth words");
const quiet = console.error;
console.error = () => {};
const failed = await report(bob, fifth);
console.error = quiet;
ok(failed.ok, "the reporter is still thanked");
ok(
  sentryCaptures().some(
    (e) => e instanceof Error && e.message === "Resend is down",
  ),
  "…the failure is captured for Sentry",
);
ok((await reportsOn(fifth)).length === 1, "…and the report is recorded");
ok(
  alert.reportAlert.lastSentAt === null,
  "…and the window is given back, so the next report tries again",
);
alert.reportAlert.send = record;

heading("hiding a comment resolves every open report on it");
freshWindow();
const hideMe = await post("Hide me");
await report(bob, hideMe);
await report(carol, hideMe);
ok(
  (await reportsOn(hideMe)).filter((r) => r.status === "open").length === 2,
  "two open reports on one comment",
);
as(admin);
ok((await moderation.hideComment(hideMe)).ok, "an admin hides it");
const afterHide = await reportsOn(hideMe);
ok(
  afterHide.every(
    (r) => r.status === "resolved" && r.resolvedBy === admin.id && r.resolvedAt,
  ),
  "both are resolved, recording who and when",
);
let view = await inbox.listReports({ filter: "resolved", query: "Hide me" });
ok(
  view.rows.length === 2 &&
    view.rows.every(
      (r) => r.current.state !== "deleted" && r.current.hidden === true,
    ),
  "the inbox shows them resolved, the comment hidden",
);
ok(
  !(await inbox.listReports({ query: "Hide me" })).rows.length,
  "…and they have left the open filter",
);
ok((await moderation.unhideComment(hideMe)).ok, "unhide works");

heading("an admin's delete resolves them and says who removed it");
const deleteMe = await post("Delete me");
await report(bob, deleteMe);
await report(dave, deleteMe);
as(admin);
ok((await moderation.deleteComment(deleteMe)).ok, "an admin deletes it");
ok(
  (await reportsOn(deleteMe)).every((r) => r.status === "resolved"),
  "both reports are resolved",
);
const [kept] = await db
  .select()
  .from(comments)
  .where(eq(comments.id, deleteMe));
ok(
  kept?.deletedAt &&
    kept.deletedBy === "admin" &&
    kept.hiddenAt === null &&
    kept.body === "",
  "the reported comment is kept as a stub marked deleted by an admin, not hidden",
);
view = await inbox.listReports({ filter: "all", query: "Delete me" });
ok(
  view.rows.length === 2 &&
    view.rows.every(
      (r) => r.current.state === "deleted" && r.current.by === "admin",
    ) &&
    view.rows.every((r) => r.snapshot.body === "Delete me"),
  "the inbox says 'Removed by an admin since' over the snapshot",
);
const plain = await post("Never reported");
as(admin);
await moderation.deleteComment(plain);
ok(
  (await db.select().from(comments).where(eq(comments.id, plain))).length === 0,
  "an unreported comment with no replies is still deleted outright",
);

heading("edited, then deleted by its author");
const edited = await post("Before the edit");
await report(carol, edited);
as(alice);
await thread.editComment({ commentId: edited, body: "After the edit" });
as(admin);
view = await inbox.listReports({ query: "Before the edit" });
let row = view.rows[0];
ok(
  row?.current.state === "edited" && row.current.body === "After the edit",
  "the inbox shows the edit beside the snapshot",
);
as(alice);
await thread.deleteOwnComment(edited);
as(admin);
view = await inbox.listReports({ query: "Before the edit" });
row = view.rows[0];
ok(
  row?.snapshot.body === "Before the edit" &&
    row.current.state === "deleted" &&
    row.current.by === "author",
  "…then 'Deleted by its author since', the original snapshot intact",
);
ok(row?.status === "open", "…and the report is still open");
ok(
  row?.name?.name === "Alice Aye" && row.snapshot.account?.id === alice.id,
  "the posting name and the account behind it are still known",
);

heading("the inbox list: search, filters, paging");
as(admin);
const byName = await inbox.listReports({ query: "alice aye", filter: "all" });
ok(
  byName.matching >= 8 &&
    byName.rows.every((r) => r.snapshot.name === "Alice Aye"),
  `search matches the posting name (${byName.matching})`,
);
const byReporter = await inbox.listReports({
  query: "Reporter 3 Check",
  filter: "all",
});
ok(
  byReporter.matching >= 1 &&
    byReporter.rows.every((r) => r.reporter?.id === erin.id),
  "search matches the reporter",
);
const byBody = await inbox.listReports({ query: "fourth WORDS" });
ok(byBody.matching === 1, "search matches the snapshot body, any case");
const all = await inbox.listReports({ filter: "all", query: "check" });
const openOnly = await inbox.listReports({ filter: "open", query: "check" });
const resolved = await inbox.listReports({
  filter: "resolved",
  query: "check",
});
ok(
  openOnly.matching + resolved.matching === all.matching,
  "open + resolved = all",
);
ok(
  openOnly.rows.every((r) => r.status === "open") &&
    resolved.rows.every((r) => r.status === "resolved"),
  "each filter holds only its own status",
);
const far = await inbox.listReports({ page: 999, filter: "all" });
ok(far.page === far.pageCount, "an out-of-range page clamps to the last");
ok(
  (await inbox.countOpenReports()) === far.openTotal,
  "countOpenReports agrees with the list's open total",
);
const target = openOnly.rows.find((r) => r.status === "open")!;
ok((await moderation.resolveReport(target.id)).ok, "Resolve works");
ok(
  !(await moderation.resolveReport(target.id)).ok,
  "…once: resolving it again is refused",
);

heading("the admin writes refuse a member");
as(bob);
for (const [label, fn] of [
  ["hide", () => moderation.hideComment(first)],
  ["delete", () => moderation.deleteComment(first)],
  ["resolve", () => moderation.resolveReport(target.id)],
  ["retire", () => names.adminRetireName("x")],
  ["clear avatar", () => names.clearAvatar("x")],
  ["list", () => inbox.listReports()],
] as const) {
  let threw = false;
  try {
    await fn();
  } catch {
    threw = true;
  }
  ok(threw, `${label} throws for a member session`);
}

heading("the removal confirmation's count");
const aliceLive = await db
  .select({ id: comments.id, deletedAt: comments.deletedAt })
  .from(comments)
  .where(eq(comments.authorId, alice.id));
const impact = await removal.removalImpact([alice.id, bob.id]);
ok(
  impact.comments === aliceLive.filter((c) => !c.deletedAt).length,
  `counts the members' live comments (${impact.comments})`,
);
await h.setSettings({ removedMemberComments: "delete" });
ok(
  (await removal.removalImpact([alice.id])).policy === "delete",
  "reports the delete policy when set",
);
await h.setSettings({ removedMemberComments: null });
ok(
  (await removal.removalImpact([alice.id])).policy === "anonymise",
  "…and anonymise when unset",
);
ok(
  (await removal.removalImpact([bob.id])).comments === 0,
  "a member with no comments counts zero",
);

heading("who deleted it: deleted_by, never inferred");
// An admin hides a comment with a reply, then its author deletes it: the
// author's delete, whatever the hidden flag says.
const gina = await h.scratchUser({ name: "Gina Check" });
async function postAs(
  user: Scratch,
  name: string,
  body: string,
  parentId?: string,
) {
  as(user);
  const added = await names.addName({ name });
  const nameId = added.ok ? added.name.id : (await names.listMyNames())[0]!.id;
  const r = await thread.createComment({
    issueId: issue.id,
    body,
    parentId,
    nameId,
  });
  if (!r.ok) throw new Error(r.reason);
  return r.id;
}
const hiddenFirst = await postAs(gina, "Gina Gee", "Hidden, then deleted");
await postAs(bob, "Bob Bee", "A reply", hiddenFirst);
await report(carol, hiddenFirst);
as(admin);
await moderation.hideComment(hiddenFirst);
as(gina);
await thread.deleteOwnComment(hiddenFirst);
as(admin);
view = await inbox.listReports({
  filter: "all",
  query: "Hidden, then deleted",
});
ok(
  view.rows[0]?.current.state === "deleted" &&
    view.rows[0].current.by === "author",
  "admin hides, then the author deletes: 'Deleted by its author since'",
);
const [authorStub] = await db
  .select()
  .from(comments)
  .where(eq(comments.id, hiddenFirst));
ok(authorStub?.deletedBy === "author", "…recorded as deleted_by author");

// A removal under the delete policy keeps reported comments as admin stubs.
const frank = await h.scratchUser({ name: "Frank Check" });
as(frank);
const frankName = await names.addName({ name: "Frank Eff" });
const frankPost = async (body: string, parentId?: string) => {
  as(frank);
  const r = await thread.createComment({
    issueId: issue.id,
    body,
    parentId,
    nameId: frankName.ok ? frankName.name.id : "",
  });
  if (!r.ok) throw new Error(r.reason);
  return r.id;
};
const frankTop = await frankPost("Frank on top");
const frankReply = await frankPost("Frank replying", first);
const frankQuiet = await frankPost("Frank unreported");
await report(dave, frankTop);
await report(erin, frankReply);
await h.setSettings({ removedMemberComments: "delete" });
ok(
  (await removal.deleteUser(frank.id, admin.id)).ok,
  "a member is removed under the delete policy",
);
await h.setSettings({ removedMemberComments: null });
const frankRows = await db
  .select()
  .from(comments)
  .where(inArray(comments.id, [frankTop, frankReply, frankQuiet]));
ok(
  frankRows.length === 2 &&
    frankRows.every((c) => c.deletedBy === "admin" && c.body === ""),
  "their reported comment and reply stay as stubs deleted by an admin; the unreported one goes",
);
as(admin);
view = await inbox.listReports({ filter: "all", query: "Frank" });
ok(
  view.rows.length === 2 &&
    view.rows.every(
      (r) => r.current.state === "deleted" && r.current.by === "admin",
    ),
  "…and the inbox says 'Removed by an admin since'",
);

heading("the report link never comes from a request header");
ok(
  (await emailLinkOrigin(undefined, true)) === null,
  "production without APP_URL: no link, so no email",
);
ok(
  (await emailLinkOrigin("https://club.example/", true)) ===
    "https://club.example",
  "production with APP_URL: that address",
);
ok(
  (await emailLinkOrigin(undefined, false)) === "http://localhost:3000",
  "outside production, outside a request: localhost",
);

heading("a fresh deployment has discussion off");
await h.withoutSettingsRow(async () => {
  ok(!(await getSettings()).commentsEnabled, "no settings row: discussion off");
  as(alice);
  const refused = await thread.createComment({
    issueId: issue.id,
    body: "x",
    nameId: aliceName.ok ? aliceName.name.id : "",
  });
  ok(!refused.ok, "…and posting is refused");
});

// Reports on this run's comments go with the issue.
await h.finish();
