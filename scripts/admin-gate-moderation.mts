// The moderation half of dev-admin-gate.mts (issue #302): each reports-inbox
// action — Resolve, Hide, Delete, Clear avatar, Retire name — is captured as
// the real server-action request an admin's click sends, then replayed against
// a second, untouched target signed out and as a plain member (nothing may
// change) and finally as the admin (it must, which proves the replay valid).
import type { Page, Request } from "playwright";
import type postgres from "postgres";
import { reportsFixtures } from "./fixtures/reports-fixtures.mts";

type Captured = { url: string; headers: Record<string, string>; body: Buffer };

type Deps = {
  sql: postgres.Sql;
  base: string;
  adminPage: Page;
  memberCookie: string;
  adminCookie: string;
  ok: (cond: unknown, msg: string) => void;
};

async function replay(c: Captured, cookie: string | undefined) {
  const headers: Record<string, string> = {
    "content-type": c.headers["content-type"] ?? "",
    "next-action": c.headers["next-action"] ?? "",
  };
  if (cookie) headers.cookie = cookie;
  await fetch(c.url, {
    method: "POST",
    headers,
    body: new Uint8Array(c.body),
    redirect: "manual",
  });
}

export async function checkModerationRefused(d: Deps) {
  const { sql, adminPage: page, ok } = d;
  const f = reportsFixtures(sql, "admin-gate");
  try {
    const issueId = await f.issue();
    const author = await f.user(`${f.stamp} Author`);
    const reporter = await f.user(`${f.stamp} Reporter`);
    const setUp = async (label: string, name: string) => {
      const avatar = await f.avatar({ stored: false });
      const nameId = await f.name(author.id, name, avatar.id);
      const comment = await f.comment(
        issueId,
        author,
        nameId,
        `${label} words`,
      );
      const report = await f.report(comment, reporter.id);
      return { nameId, comment, report };
    };
    const a = await setUp("Clicked", "Ann Aye");
    const b = await setUp("Replayed", "Ben Bee");
    await page.goto(
      `${d.base}/admin/reports?filter=all&q=${encodeURIComponent("Clicked words")}`,
    );
    await page.waitForSelector("h1:has-text('Reports')");

    const one = async (q: postgres.PendingQuery<postgres.Row[]>) =>
      (await q)[0]!;
    const cases: {
      label: string;
      button: string;
      confirm?: string;
      from: string;
      to: string;
      changed: () => Promise<boolean>;
    }[] = [
      {
        label: "resolve",
        button: "Resolve report of the comment by Ann Aye",
        from: a.report,
        to: b.report,
        changed: async () =>
          (
            await one(
              sql`select status from comment_reports where id = ${b.report}`,
            )
          ).status === "resolved",
      },
      {
        label: "hide",
        button: "Hide comment by Ann Aye",
        from: a.comment,
        to: b.comment,
        changed: async () =>
          (
            await one(
              sql`select hidden_at from comments where id = ${b.comment}`,
            )
          ).hidden_at !== null,
      },
      {
        label: "delete",
        button: "Delete comment by Ann Aye",
        confirm: "Delete comment",
        from: a.comment,
        to: b.comment,
        changed: async () =>
          (
            await one(
              sql`select deleted_at from comments where id = ${b.comment}`,
            )
          ).deleted_at !== null,
      },
      {
        label: "clear avatar",
        button: "Clear avatar for Ann Aye",
        confirm: "Clear avatar",
        from: a.nameId,
        to: b.nameId,
        changed: async () =>
          (
            await one(
              sql`select avatar_image_id from member_names where id = ${b.nameId}`,
            )
          ).avatar_image_id === null,
      },
      {
        label: "retire name",
        button: "Retire name Ann Aye",
        confirm: "Retire name",
        from: a.nameId,
        to: b.nameId,
        changed: async () =>
          (
            await one(
              sql`select retired_at from member_names where id = ${b.nameId}`,
            )
          ).retired_at !== null,
      },
    ];

    for (const c of cases) {
      const sent = page.waitForRequest(
        (r: Request) =>
          r.method() === "POST" && r.headers()["next-action"] !== undefined,
      );
      await page.getByRole("button", { name: c.button, exact: true }).click();
      if (c.confirm) {
        await page
          .getByRole("dialog")
          .getByRole("button", { name: c.confirm })
          .click();
      }
      const request = await sent;
      const body = request.postDataBuffer() ?? Buffer.alloc(0);
      ok(
        body.toString().includes(c.from),
        `captured the admin's ${c.label} action request`,
      );
      const captured: Captured = {
        url: request.url(),
        headers: await request.allHeaders(),
        body: Buffer.from(body.toString().replaceAll(c.from, c.to)),
      };
      await request.response();
      await replay(captured, undefined);
      ok(
        !(await c.changed()),
        `replayed ${c.label} signed out: nothing changed`,
      );
      await replay(captured, d.memberCookie);
      ok(
        !(await c.changed()),
        `replayed ${c.label} as a member: nothing changed`,
      );
      await replay(captured, d.adminCookie);
      ok(
        await c.changed(),
        `replayed ${c.label} as the admin: it applies (a valid replay)`,
      );
    }
  } finally {
    await f.cleanup();
  }
}
