// Scratch discussion data for the browser gates of issue #302: an admin with a
// session, members with posting names (one with an avatar), a published issue
// numbered well above the real ones, comments and reports — written straight
// to the database, every row prefixed check-302 and removed by id.
import { randomUUID } from "node:crypto";
import type { BrowserContext } from "playwright";
import type postgres from "postgres";
import { emptyIssueContent } from "../../src/lib/blocks.ts";
import { deleteObject, putObject } from "../../src/lib/storage.ts";

type Sql = postgres.Sql;

export function reportsFixtures(sql: Sql, label: string) {
  const stamp = `check-302-${label}-${randomUUID().slice(0, 8)}`;
  const made = {
    users: [] as string[],
    issues: [] as string[],
    images: [] as { id: string; key: string }[],
    sessions: [] as string[],
  };

  async function user(name: string, isAdmin = false) {
    const id = randomUUID();
    const email = `${stamp}-${made.users.length}@example.invalid`;
    await sql`insert into users (id, email, name, is_admin, subscribed, email_verified)
      values (${id}, ${email}, ${name}, ${isAdmin}, false, now())`;
    made.users.push(id);
    return { id, email, name };
  }

  async function session(userId: string) {
    const token = `${stamp}-session-${made.sessions.length}`;
    await sql`insert into sessions (session_token, user_id, expires)
      values (${token}, ${userId}, now() + interval '1 day')`;
    made.sessions.push(token);
    return token;
  }

  async function signIn(ctx: BrowserContext, base: string, userId: string) {
    await ctx.addCookies([
      {
        name: "authjs.session-token",
        value: await session(userId),
        url: base,
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
  }

  async function issue() {
    const id = randomUUID();
    const [max] =
      await sql`select coalesce(max(number), 0)::int as n from issues`;
    await sql`insert into issues (id, number, title, content, status, published_at)
      values (${id}, ${(max!.n as number) + 7000}, ${`${stamp} issue`},
        ${sql.json(emptyIssueContent())}, 'published', now())`;
    made.issues.push(id);
    return id;
  }

  // An uploaded picture with no issue, as an avatar is: a stored object too,
  // so a gate can prove removal takes it out of storage.
  async function avatar() {
    const id = randomUUID();
    const key = `check-302/${stamp}/${id}.webp`;
    await putObject(key, Buffer.from("avatar"), "image/webp");
    await sql`insert into images (id, key, width, height)
      values (${id}, ${key}, 1, 1)`;
    made.images.push({ id, key });
    return { id, key };
  }

  async function name(userId: string, text: string, avatarId?: string) {
    const id = randomUUID();
    await sql`insert into member_names (id, user_id, name, name_key, avatar_image_id)
      values (${id}, ${userId}, ${text}, ${text.toLowerCase()}, ${avatarId ?? null})`;
    return id;
  }

  async function comment(
    issueId: string,
    author: { id: string },
    nameId: string,
    body: string,
    minutesAgo = 0,
  ) {
    const id = randomUUID();
    await sql`insert into comments (id, issue_id, author_id, author_name_id, body, created_at)
      values (${id}, ${issueId}, ${author.id}, ${nameId}, ${body},
        now() - ${`${minutesAgo} minutes`}::interval)`;
    return id;
  }

  // A report as createReport writes one: the comment snapshotted as it reads.
  async function report(
    commentId: string,
    reporterId: string,
    opts: { reason?: string; note?: string | null; minutesAgo?: number } = {},
  ) {
    const [c] = await sql`select c.issue_id, c.author_id, c.body, c.created_at,
        c.edited_at, n.name
      from comments c left join member_names n on n.id = c.author_name_id
      where c.id = ${commentId}`;
    const id = randomUUID();
    await sql`insert into comment_reports (id, comment_id, issue_id, reporter_id,
        reason, note, snapshot_body, snapshot_name, snapshot_author_id,
        snapshot_created_at, snapshot_edited_at, created_at)
      values (${id}, ${commentId}, ${c!.issue_id}, ${reporterId},
        ${opts.reason ?? "offensive"}, ${opts.note ?? null}, ${c!.body},
        ${c!.name}, ${c!.author_id}, ${c!.created_at}, ${c!.edited_at},
        now() - ${`${opts.minutesAgo ?? 0} minutes`}::interval)`;
    return id;
  }

  async function cleanup() {
    if (made.issues.length) {
      await sql`delete from issues where id in ${sql(made.issues)}`;
    }
    if (made.users.length) {
      await sql`delete from sessions where user_id in ${sql(made.users)}`;
      await sql`delete from users where id in ${sql(made.users)}`;
    }
    for (const image of made.images) {
      await sql`delete from images where id = ${image.id}`;
      await deleteObject(image.key).catch(() => {});
    }
  }

  return {
    stamp,
    made,
    user,
    session,
    signIn,
    issue,
    avatar,
    name,
    comment,
    report,
    cleanup,
  };
}
