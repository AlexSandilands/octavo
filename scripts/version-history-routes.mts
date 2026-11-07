// The running-server half of dev-version-history-gate.mts (aboard #51): the
// editor's save route keeping a version, the History routes and their
// refusals, the preview page, and the History tab and restore in Chromium.
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { desc, eq, sql } from "drizzle-orm";
import { chromium, type Page as Tab } from "playwright";
import { db } from "../src/db";
import { issues, sessions, users } from "../src/db/schema";
import type { IssueContent } from "../src/lib/blocks";
import { createId } from "../src/lib/id";
import { hashSessionToken } from "../src/lib/session-token";
import { getIssue } from "../src/server/issues";
import { listVersions } from "../src/server/issue-versions";

type Ctx = {
  base: string;
  shots: string | null;
  ok: (cond: unknown, msg: string) => void;
  newIssue: () => Promise<string>;
  backdate: (id: string, minutes?: number) => Promise<void>;
  made: { users: string[] };
};

export async function routeChecks(ctx: Ctx) {
  const { base, ok } = ctx;
  const userId = createId();
  await db.insert(users).values({
    id: userId,
    email: `gate51-${userId}@example.test`,
    isAdmin: true,
    subscribed: false,
    emailVerified: new Date(),
  });
  ctx.made.users.push(userId);
  const token = `gate51-${createId()}`;
  await db.insert(sessions).values({
    sessionToken: hashSessionToken(token),
    userId,
    expires: new Date(Date.now() + 86_400_000),
  });
  const cookie = `authjs.session-token=${token}`;
  const call = (
    url: string,
    init: {
      method?: string;
      body?: unknown;
      headers?: Record<string, string>;
    } = {},
  ) =>
    fetch(base + url, {
      method: init.method ?? "GET",
      redirect: "manual",
      headers: {
        cookie,
        origin: base,
        "content-type": "application/json",
        ...init.headers,
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });

  // A real issue's pages, so the screenshots look like a magazine.
  const [source] = await db
    .select({ content: issues.content })
    .from(issues)
    .where(eq(issues.status, "published"))
    .orderBy(desc(issues.number))
    .limit(1);
  if (!source) throw new Error("no published issue to copy pages from");
  const full: IssueContent = source.content;
  ok(full.pages.length >= 5, `source issue has ${full.pages.length} pages`);

  // ── The save route keeps a version ────────────────────────────────────────
  const id = await ctx.newIssue();
  const save = (content: IssueContent, baseRevision: number) =>
    call(`/api/admin/issues/${id}/save`, {
      method: "POST",
      body: { kind: "content", content, baseRevision },
    });
  ok((await save(full, 0)).status === 200, "the save route saves");
  await ctx.backdate(id);
  const trimmed = { ...full, pages: full.pages.slice(0, -3) };
  ok((await save(trimmed, 1)).status === 200, "a save dropping 3 pages lands");

  const list = await call(`/api/admin/issues/${id}/versions`);
  const { versions } = (await list.json()) as {
    versions: { id: string; reason: string; pageCount: number }[];
  };
  ok(
    list.status === 200 &&
      versions.length === 1 &&
      versions[0]!.reason === "large-removal" &&
      versions[0]!.pageCount === full.pages.length,
    "the History route lists the large-removal version",
  );
  const kept = versions[0]!.id;
  const anon = await fetch(`${base}/api/admin/issues/${id}/versions`);
  ok(anon.status === 403, "the History route refuses a signed-out request");

  // ── Restore and its refusals ──────────────────────────────────────────────
  const restore = (
    versionId: string,
    body: unknown,
    headers: Record<string, string> = {},
  ) =>
    call(`/api/admin/issues/${id}/versions/${versionId}/restore`, {
      method: "POST",
      body,
      headers,
    });
  ok(
    (await restore(kept, { baseRevision: 2 }, { "content-type": "text/plain" }))
      .status === 415,
    "restore refuses a non-JSON body",
  );
  ok(
    (
      await restore(
        kept,
        { baseRevision: 2 },
        { origin: "https://elsewhere.example" },
      )
    ).status === 403,
    "restore refuses a cross-origin request",
  );
  ok(
    (await restore(kept, { baseRevision: "2" })).status === 400,
    "restore refuses a malformed body",
  );
  ok(
    (await restore(createId(), { baseRevision: 2 })).status === 404,
    "restore of an unknown version is 404",
  );
  const stale = await restore(kept, { baseRevision: 1 });
  ok(
    stale.status === 409 &&
      ((await stale.json()) as { reason: string }).reason === "conflict",
    "a stale tab's restore is a conflict",
  );
  const done = await restore(kept, { baseRevision: 2 });
  const result = (await done.json()) as { ok: boolean; revision: number };
  ok(
    done.status === 200 && result.ok && result.revision === 3,
    "restore lands and bumps the revision",
  );
  ok(
    (await getIssue(id))!.content.pages.length === full.pages.length,
    "the issue has its pages back",
  );
  const after = await listVersions(id);
  ok(
    after[0]!.reason === "before-restore" &&
      after[0]!.pageCount === trimmed.pages.length,
    "the trimmed pages are kept as before-restore",
  );
  const staleSave = await save(trimmed, 2);
  ok(staleSave.status === 409, "an editor still on revision 2 gets a conflict");

  // ── The preview page ──────────────────────────────────────────────────────
  const preview = await call(`/admin/issues/${id}/history/${kept}`);
  ok(
    preview.status === 200 && (await preview.text()).includes("Version from"),
    "the preview page renders the version with its banner",
  );
  // Streamed past the root loading.tsx, so the not-found page arrives as a 200.
  const unknown = await call(`/admin/issues/${id}/history/${createId()}`);
  const unknownBody = await unknown.text();
  ok(
    unknownBody.includes("page not found") &&
      !unknownBody.includes("Version from"),
    "an unknown version's preview is the not-found page",
  );

  await browserChecks(ctx, token, id, kept, full.pages.length);
}

async function browserChecks(
  ctx: Ctx,
  token: string,
  id: string,
  kept: string,
  fullPages: number,
) {
  const { base, ok } = ctx;
  const shots = ctx.shots;
  if (shots) await mkdir(shots, { recursive: true });
  const shot = async (tab: Tab, name: string) => {
    if (!shots) return;
    await tab.screenshot({
      path: path.join(shots, `${name}.jpg`),
      type: "jpeg",
      quality: 80,
    });
  };

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    await context.addCookies([
      { name: "authjs.session-token", value: token, url: base },
    ]);
    const tab = await context.newPage();

    const openHistory = async (issueId: string) => {
      await tab.goto(`${base}/admin/issues/${issueId}/edit`);
      await tab.getByRole("button", { name: "Panel", exact: true }).click();
      await tab
        .locator("[data-surface-choice]")
        .getByRole("button", { name: "History" })
        .click();
      // Let the panel finish sliding in before anything is measured or shot.
      await tab.waitForTimeout(500);
    };

    // The empty state, on a draft with no versions.
    const empty = await ctx.newIssue();
    await openHistory(empty);
    await tab.waitForSelector("[data-history-empty]");
    ok(true, "a draft with no versions shows the empty state");
    await shot(tab, "history-empty");

    // The list, and the dialog's keyboard behaviour.
    await openHistory(id);
    await tab.waitForSelector(`[data-version="${kept}"]`);
    ok(
      (await tab.locator("[data-version]").count()) === 2,
      "the History tab lists both versions",
    );
    await shot(tab, "history-tab");
    const row = tab.locator(`[data-version="${kept}"]`);
    const trigger = row.getByRole("button", { name: /^Restore/ });
    await trigger.click();
    const dialog = tab.getByRole("dialog", { name: "Restore this version?" });
    await dialog.waitFor();
    ok(
      !(await dialog.textContent())!.includes("published"),
      "a draft's dialog says nothing about members",
    );
    await shot(tab, "restore-dialog");
    await tab.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
    ok(
      await trigger.evaluate((el) => el === document.activeElement),
      "Escape closes the dialog and hands the focus back",
    );

    // Restore from the tab: the editor reloads onto the kept pages.
    const before = (await getIssue(id))!.revision;
    await trigger.click();
    await dialog.getByRole("button", { name: "Restore" }).click();
    await tab.waitForEvent("load");
    const now = (await getIssue(id))!;
    ok(
      now.revision > before && now.content.pages.length === fullPages,
      "restoring from the tab lands and reloads the editor",
    );

    // A published issue's dialog warns that members see it at once.
    const [top] = await db
      .select({ n: sql<number>`coalesce(max(${issues.number}), 0)` })
      .from(issues)
      .where(eq(issues.status, "published"));
    await db
      .update(issues)
      .set({ status: "published", number: Number(top?.n ?? 0) + 1000 })
      .where(eq(issues.id, id));
    await openHistory(id);
    await tab.waitForSelector("[data-version]");
    await tab
      .locator("[data-version]")
      .first()
      .getByRole("button", { name: /^Restore/ })
      .click();
    await dialog.waitFor();
    ok(
      (await dialog.textContent())!.includes("members will see"),
      "a published issue's dialog says members see it at once",
    );
    await shot(tab, "restore-dialog-published");
    await dialog.getByRole("button", { name: "Cancel" }).click();

    // The preview, at a computer's width and a phone's.
    await tab.goto(`${base}/admin/issues/${id}/history/${kept}`);
    await tab.getByText("Version from").waitFor();
    await tab.waitForTimeout(800);
    await shot(tab, "preview-desktop");
    await tab.getByRole("button", { name: "Restore this version" }).click();
    await dialog.waitFor();
    await shot(tab, "preview-restore-dialog");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await tab.setViewportSize({ width: 390, height: 844 });
    await tab.reload();
    await tab.getByText("Version from").waitFor();
    await tab.waitForTimeout(800);
    await shot(tab, "preview-phone");
    ok(
      (await tab.getByRole("button", { name: /download/i }).count()) === 0 &&
        (await tab.getByRole("link", { name: /download/i }).count()) === 0,
      "the preview offers no PDF download (it would print today's pages)",
    );
    ok(true, "the preview renders at desktop and phone widths");
  } finally {
    await browser.close();
  }
}
