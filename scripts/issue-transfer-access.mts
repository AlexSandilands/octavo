// The access checks and the real-workflow round trip of the issue-transfer gate
// (issue #293), kept out of the gate itself so both stay readable.
import { chromium } from "playwright";
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

/** The imported draft really is editable: it opens in the editor, the autosave
 *  endpoint takes a change, and the result exports and imports again. */
export async function checkRealWorkflow(
  ok: Ok,
  context: {
    base: string;
    adminCookie: string;
    issueId: string;
    content: unknown;
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
    await page.goto(`${context.base}/admin/issues/${context.issueId}/edit`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector("[data-block-id]", { timeout: 60_000 });
    ok(true, "the imported draft opens in the editor");
  } finally {
    await browser.close();
  }

  const edited = structuredClone(context.content) as {
    pages: { blocks: { type: string; text?: string }[] }[];
  };
  const block = edited.pages[1]?.blocks[0];
  if (block?.type === "text") block.text = EDIT_MARKER;
  const save = await fetch(
    `${context.base}/api/admin/issues/${context.issueId}/save`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: new URL(context.base).origin,
        cookie: context.adminCookie,
      },
      body: JSON.stringify({
        kind: "content",
        content: edited,
        baseRevision: 0,
      }),
    },
  );
  ok(save.status === 200, "the editor's autosave endpoint accepts the change");

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
