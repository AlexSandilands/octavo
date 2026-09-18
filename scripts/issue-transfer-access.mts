// The access checks and the real-workflow round trip of the issue-transfer gate
// (issue #293), kept out of the gate itself so both stay readable.
import { eq } from "drizzle-orm";
import { chromium } from "playwright";
import { db } from "../src/db/index.ts";
import { issues } from "../src/db/schema.ts";
import { MAX_BUNDLE_ISSUES } from "../src/lib/issue-transfer/limits.ts";
import { scratchMember } from "./issue-transfer-fixtures.mts";

type Ok = (cond: unknown, msg: string) => void;
type Sent = { ok: boolean; status: number; message?: string };

/** Signed out, a member, and another origin — on all three routes. */
export async function checkAccess(
  ok: Ok,
  context: {
    base: string;
    adminCookie: string;
    bundle: Buffer;
    issueId: string;
    exportBundle: (ids: string[], cookie?: string) => Promise<Response>;
    planRequest: (cookie: string, origin?: string) => Promise<Response>;
    sendBundle: (
      archive: Buffer,
      options?: { cookie?: string; omitOrigin?: boolean },
    ) => Promise<Sent>;
  },
): Promise<void> {
  const member = await scratchMember();
  for (const [label, cookie] of [
    ["signed out", ""],
    ["a member", member.cookie],
  ] as const) {
    ok(
      (await context.exportBundle([context.issueId], cookie)).status === 403,
      `export refuses ${label}`,
    );
    ok(
      (await context.planRequest(cookie)).status === 403,
      `the plan endpoint refuses ${label}`,
    );
    ok(
      (await context.sendBundle(context.bundle, { cookie })).status === 403,
      `import refuses ${label}`,
    );
  }

  const crossOrigin = await fetch(`${context.base}/api/admin/issues/export`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://evil.example",
      cookie: context.adminCookie,
    },
    body: JSON.stringify({ ids: [context.issueId] }),
  });
  ok(crossOrigin.status === 403, "export refuses another origin");
  ok(
    (await context.planRequest(context.adminCookie, "https://evil.example"))
      .status === 403,
    "the plan endpoint refuses another origin",
  );
  ok(
    (await context.sendBundle(context.bundle, { omitOrigin: true })).status ===
      403,
    "import refuses a request that carries no origin",
  );

  const tooMany = await context.exportBundle(
    Array.from({ length: MAX_BUNDLE_ISSUES + 1 }, () => crypto.randomUUID()),
  );
  ok(tooMany.status === 400, "an over-limit export is refused");
  const refusal = (await tooMany.json()) as { error: string };
  ok(
    refusal.error.includes("Deselect"),
    `and says what to deselect (“${refusal.error}”)`,
  );
}

/**
 * The imported draft really is editable, driven the way an owner drives it: the
 * editor opens it, a body block is typed into, the autosave settles, a reload
 * shows the text — then it exports and imports again. Posting to the save route
 * would only prove the server accepts a document; the bug class this exists for
 * is client-to-server.
 */
export async function checkRealWorkflow(
  ok: Ok,
  context: {
    base: string;
    adminCookie: string;
    issueId: string;
    textBlockId: string;
    exportBundle: (ids: string[]) => Promise<Response>;
    sendBundle: (archive: Buffer) => Promise<Sent & { result?: unknown }>;
  },
): Promise<string | null> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.context().addCookies([
      {
        name: "authjs.session-token",
        value: context.adminCookie.split("=")[1]!,
        url: context.base,
      },
    ]);
    const editor = `${context.base}/admin/issues/${context.issueId}/edit`;
    const body = page.locator(
      `[data-block-id="${context.textBlockId}"] [data-text-body]`,
    );
    // The canvas shows one page at a time, and the text block is on page two.
    const open = async () => {
      await page.goto(editor, { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Page 2", exact: true }).click();
      await body.waitFor({ timeout: 60_000 });
    };
    await open();
    ok(true, "the imported draft opens in the editor");

    await body.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type(EDIT_MARKER);
    ok(
      (await body.innerText()).includes(EDIT_MARKER),
      "the typing reaches the block",
    );

    // The indicator flips too briefly to be a reliable signal; the stored
    // document is the thing that has to change.
    const stored = await waitFor(async () => {
      const [row] = await db
        .select({ content: issues.content, revision: issues.revision })
        .from(issues)
        .where(eq(issues.id, context.issueId))
        .limit(1);
      return row && JSON.stringify(row.content).includes(EDIT_MARKER)
        ? row
        : null;
    });
    ok(
      stored !== null && stored.revision > 0,
      `the autosave stored it (revision ${stored?.revision ?? "—"})`,
    );

    await open();
    ok(
      (await body.innerText()).includes(EDIT_MARKER),
      "and the edit is there after a reload",
    );
  } finally {
    await browser.close();
  }

  const exported = await context.exportBundle([context.issueId]);
  ok(exported.status === 200, "the edited issue exports again");
  const again = await context.sendBundle(
    Buffer.from(await exported.arrayBuffer()),
  );
  ok(
    again.ok,
    `and that export imports${again.ok ? "" : `: ${again.message}`}`,
  );
  if (!again.ok) return null;
  return (again.result as { issues: { id: string }[] }).issues[0]!.id;
}

/** The text the workflow check writes, so the gate can look for it. */
export const EDIT_MARKER = "Edited after import.";

async function waitFor<T>(
  probe: () => Promise<T | null | undefined>,
  timeoutMs = 30_000,
): Promise<T | null> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const found = await probe();
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
}
