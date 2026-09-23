// Both unsubscribe purposes (issue #303), for dev-notifications-gate.mts: the
// reply email's "Stop reply emails" (page and one-click), an issues token as
// every pre-#303 email carries it, and relabelled tokens refused. Plus the
// reply email's conditions in-process, against a recording transport.
import { createHmac } from "node:crypto";
import type { Page } from "playwright";
import type { Cast } from "./notifications-gate-email.mts";
import type { Kit } from "./notifications-gate-kit.mts";

const tokens = () => import("../src/server/unsubscribe-token.ts");
const alert = () => import("../src/server/reply-alert.ts");
const sentry = () => import("./fixtures/discussion/sentry-stub.mts");

// A token exactly as the code before #303 minted it: the bare user id.
function legacyToken(userId: string) {
  const key = createHmac("sha256", process.env.AUTH_SECRET!)
    .update("octavo/unsubscribe/v1")
    .digest();
  const mac = createHmac("sha256", key).update(userId).digest("base64url");
  return `${Buffer.from(userId).toString("base64url")}.${mac}`;
}

// The same signature over a different payload — a purpose swapped or dropped.
function relabel(token: string, payload: (old: string) => string) {
  const [body, mac] = token.split(".");
  const old = Buffer.from(body!, "base64url").toString("utf8");
  return `${Buffer.from(payload(old)).toString("base64url")}.${mac}`;
}

export async function unsubscribeGate(k: Kit, c: Cast) {
  k.heading("Stop reply emails, and issue tokens already in inboxes");
  const flags = async () => {
    const [row] = await k.sql<{ subscribed: boolean; reply_emails: boolean }[]>`
      select subscribed, reply_emails from users where id = ${c.pat.id}`;
    return `${row!.subscribed ? "S" : "-"}${row!.reply_emails ? "R" : "-"}`;
  };
  await k.sql`update users set subscribed = true, reply_emails = true
    where id = ${c.pat.id}`;
  const url = (await k.logged("reply", "unsubscribe for", c.pat.email)).at(-1);
  const replies = new URL(url!).searchParams.get("token")!;
  const t = await tokens();
  k.ok(
    t.verifyUnsubscribeToken(replies)?.purpose === "replies",
    "the email's link carries a replies token",
  );

  const ctx = await k.context(null);
  const page = await ctx.newPage();
  const open = async (token: string, text: string) => {
    await page.goto(`${k.base}/unsubscribe?token=${encodeURIComponent(token)}`);
    await page.waitForSelector(`text=${text}`, { timeout: 30_000 });
    return true;
  };
  const press = async (p: Page, name: string, then: string) => {
    await p.getByRole("button", { name }).click();
    await p.waitForSelector(`text=${then}`, { timeout: 30_000 });
  };
  k.ok(
    await open(replies, "Stop reply emails?"),
    "signed out, the page asks to stop reply emails",
  );
  await press(page, "Stop reply emails", "Reply emails are off.");
  k.ok(
    (await flags()) === "S-",
    "it flips reply_emails only (subscribed stays on)",
  );
  await press(page, "Turn reply emails back on", "Stop reply emails?");
  k.ok((await flags()) === "SR", "and turns them back on");
  const post = (token: string) =>
    fetch(`${k.base}/api/unsubscribe?token=${encodeURIComponent(token)}`, {
      method: "POST",
      body: "List-Unsubscribe=One-Click",
    }).then((r) => r.status);
  k.ok(
    (await post(replies)) === 200 && (await flags()) === "S-",
    "one-click with the replies token stops reply emails only",
  );

  await k.sql`update users set reply_emails = true where id = ${c.pat.id}`;
  const old = legacyToken(c.pat.id);
  k.ok(
    (await post(old)) === 200 && (await flags()) === "-R",
    "an existing issues token (no purpose) still flips subscribed only",
  );
  k.ok(
    await open(old, "You’ve been unsubscribed."),
    "and its page reads as it always has",
  );
  await press(page, "Resubscribe", `Unsubscribe from ${c.magazine}?`);
  k.ok(
    (await flags()) === "SR",
    "Resubscribe restores it, reply emails untouched",
  );
  const issues = t.signUnsubscribeToken(c.pat.id, "issues");
  k.ok(
    (await post(issues)) === 200 && (await flags()) === "-R",
    "a new issues token behaves the same",
  );

  await k.sql`update users set subscribed = true where id = ${c.pat.id}`;
  const forged = [
    relabel(replies, (p) => p.replace(/^replies:/, "issues:")),
    relabel(replies, (p) => p.replace(/^replies:/, "")),
    relabel(issues, (p) => p.replace(/^issues:/, "replies:")),
    relabel(old, (p) => `replies:${p}`),
  ];
  for (const token of forged) {
    k.ok(
      t.verifyUnsubscribeToken(token) === null,
      "a relabelled token fails verification…",
    );
    k.ok((await post(token)) === 400, "…one-click refuses it (400)…");
    k.ok(
      await open(token, "This link isn’t valid."),
      "…the page calls it invalid…",
    );
  }
  k.ok((await flags()) === "SR", "…and nothing changed");
  await ctx.close();
  await k.sql`update users set subscribed = false where id = ${c.pat.id}`;
}

export async function moduleGate(k: Kit, c: Cast) {
  k.heading("reply email conditions, in-process");
  const a = await alert();
  const t = await tokens();
  const sent: Parameters<typeof a.replyMail.send>[0][] = [];
  const real = a.replyMail.send;
  a.replyMail.send = async (m) => {
    sent.push(m);
  };
  const reply = (
    to: string,
    author: typeof c.pat,
    nameId: string,
    body = "check-303 in-process",
  ) =>
    k.comment(c.issue.id, author, nameId, body, {
      parentId: to,
      ago: "1 minute",
    });
  try {
    const r1 = await reply(
      c.patTop,
      c.rex,
      c.rexName,
      `${"<i>x</i> ".repeat(3)}check-303`,
    );
    await a.sendReplyEmail(r1);
    const m = sent.at(-1);
    k.ok(
      sent.length === 1 && m?.to === c.pat.email,
      "opted in: one message, to the parent's author",
    );
    k.ok(
      m?.html.includes("&lt;i&gt;x&lt;/i&gt;") && !m.html.includes("<i>x"),
      "member text escaped",
    );
    const header = m?.headers["List-Unsubscribe"] ?? "";
    const oneClick = new URL(header.slice(1, -1)).searchParams.get("token");
    const grant = t.verifyUnsubscribeToken(oneClick);
    k.ok(
      grant?.purpose === "replies" &&
        grant.userId === c.pat.id &&
        m?.headers["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click",
      "its List-Unsubscribe one-click carries a replies token",
    );
    const [row] = await k.sql`select expires from verification_tokens
      where identifier = ${c.pat.email} order by expires desc limit 1`;
    const hours = (new Date(row!.expires).getTime() - Date.now()) / 3_600_000;
    k.ok(
      hours > 23.9 && hours <= 24,
      "its magic link lives 24 hours, like the publish blast's",
    );

    const quiet = async (id: string, why: string) => {
      const n = sent.length;
      await a.sendReplyEmail(id);
      k.ok(sent.length === n, why);
    };
    await quiet(await reply(c.hughTop, c.rex, c.rexName), "opted out: nothing");
    await quiet(
      await reply(c.patTop, c.pat, c.patName),
      "your own reply: nothing",
    );
    await quiet(c.patTop, "a top-level comment: nothing");
    const hidden = await reply(c.patTop, c.rex, c.rexName);
    await k.sql`update comments set hidden_at = now() where id = ${hidden}`;
    await quiet(hidden, "a reply hidden before sending: nothing");
    const whileOff = await reply(c.patTop, c.rex, c.rexName);
    await k.sql`update settings set comments_enabled = false where id = 1`;
    try {
      await quiet(whileOff, "discussion off: nothing");
    } finally {
      await k.sql`update settings set comments_enabled = true where id = 1`;
    }
    a.replyMail.send = async () => {
      throw new Error("transport down");
    };
    const failing = await reply(c.patTop, c.rex, c.rexName);
    const quietLog = console.error;
    console.error = () => {};
    const threw = await a.sendReplyEmail(failing).then(
      () => false,
      () => true,
    );
    console.error = quietLog;
    k.ok(!threw, "a failing transport never throws into the post");
    k.ok(
      (await sentry())
        .sentryCaptures()
        .some((e) => e instanceof Error && e.message === "transport down"),
      "…and the failure is captured for Sentry",
    );
  } finally {
    a.replyMail.send = real;
  }
}
