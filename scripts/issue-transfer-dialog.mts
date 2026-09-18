// What only the real dialog in a real browser can prove (issue #293): the
// retry's status question gets through as the browser sends it — a same-origin
// GET carries no Origin header — and dismissing the dialog mid-upload stops the
// upload instead of hiding it.
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import net from "node:net";
import { and, eq, gte } from "drizzle-orm";
import { chromium, type Page } from "playwright";
import { db } from "../src/db/index.ts";
import { issueImports } from "../src/db/schema.ts";
import type { ImportResponse } from "../src/lib/issue-transfer/result.ts";
import { made, readZipEntries, writeZip } from "./issue-transfer-fixtures.mts";

type Ok = (cond: unknown, msg: string) => void;

// The upload has to be slow on the wire: a browser's own throttle only delays
// its events, and on localhost the whole body has reached the server — which
// finishes an import whatever the client then does — before anyone can dismiss.
const TRICKLE_BYTES = 1024;
const TRICKLE_EVERY_MS = 50;
const WOULD_HAVE_LANDED_MS = 10_000;
// Past what the socket buffers between browser and relay can swallow whole.
const PADDING_BYTES = 24 * 1024 * 1024;

// The importer reads only the entries the manifest lists, so an unlisted one
// makes a valid bundle as large as the case needs.
async function padded(bundleFile: string): Promise<string> {
  const entries = await readZipEntries(await readFile(bundleFile));
  const archive = await writeZip([
    ...entries.map((e) => ({ name: e.name, bytes: e.bytes, store: true })),
    { name: "padding.bin", bytes: randomBytes(PADDING_BYTES), store: true },
  ]);
  const file = `${bundleFile}.padded.zip`;
  await writeFile(file, archive);
  return file;
}

/** A TCP relay in front of the server that can trickle what the browser sends. */
async function slowRelay(target: URL) {
  const state = { slow: false };
  const server = net.createServer((client) => {
    const upstream = net.connect(Number(target.port), target.hostname);
    const queue: Buffer[] = [];
    // Paused while anything is queued, so the browser feels the slowness too
    // and its progress does not run ahead to 100%.
    const timer = setInterval(() => {
      while (queue.length) {
        const chunk = queue.shift()!;
        if (!state.slow) {
          upstream.write(chunk);
          continue;
        }
        upstream.write(chunk.subarray(0, TRICKLE_BYTES));
        if (chunk.length > TRICKLE_BYTES) {
          queue.unshift(chunk.subarray(TRICKLE_BYTES));
        }
        break;
      }
      if (!queue.length) client.resume();
    }, TRICKLE_EVERY_MS);
    client.on("data", (chunk: Buffer) => {
      if (!state.slow && !queue.length) {
        upstream.write(chunk);
        return;
      }
      queue.push(chunk);
      client.pause();
    });
    upstream.pipe(client);
    const end = () => {
      clearInterval(timer);
      client.destroy();
      upstream.destroy();
    };
    client.on("close", end).on("error", end);
    upstream.on("close", end).on("error", end);
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as net.AddressInfo;
  return {
    // The target's own hostname: `next dev` refuses its assets to any other.
    base: `http://${target.hostname}:${port}`,
    state,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

export async function checkDialog(
  ok: Ok,
  context: {
    base: string;
    adminId: string;
    adminCookie: string;
    bundleFile: string;
    committedOperationId: string | null;
  },
): Promise<void> {
  const relay = await slowRelay(new URL(context.base));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.context().addCookies([
      {
        name: "authjs.session-token",
        value: context.adminCookie.split("=")[1]!,
        url: relay.base,
      },
    ]);
    await page.goto(`${relay.base}/admin`);

    if (context.committedOperationId) {
      const asked = await page.evaluate(async (id) => {
        const response = await fetch(
          `/api/admin/issues/import?operation=${id}`,
        );
        return {
          status: response.status,
          body: (await response.json()) as unknown,
        };
      }, context.committedOperationId);
      const body = asked.body as ImportResponse;
      ok(
        asked.status === 200 && body.ok && body.retried === true,
        `the browser's own status question is answered (${asked.status})`,
      );
    }

    const through = {
      ...context,
      bundleFile: await padded(context.bundleFile),
      relay,
    };
    await dismissMidUpload(ok, page, through, "Escape", () =>
      page.keyboard.press("Escape"),
    );
    await dismissMidUpload(ok, page, through, "a backdrop press", () =>
      page.mouse.click(4, 4),
    );
  } finally {
    await browser.close();
    await relay.close();
  }
}

async function dismissMidUpload(
  ok: Ok,
  page: Page,
  context: {
    adminId: string;
    bundleFile: string;
    relay: { base: string; state: { slow: boolean } };
  },
  how: string,
  dismiss: () => Promise<void>,
): Promise<void> {
  const since = new Date();
  await page.goto(`${context.relay.base}/admin`);
  await page.getByRole("button", { name: "Import issues" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('input[type="file"]').setInputFiles(context.bundleFile);
  const confirm = dialog.getByRole("button", { name: /^Import \d+$/ });
  await confirm.waitFor({ timeout: 30_000 });

  context.relay.state.slow = true;
  await confirm.click();
  await dialog.getByText(/^Uploading…/).waitFor({ timeout: 10_000 });
  await page.waitForTimeout(500);

  await dismiss();
  await dialog.waitFor({ state: "detached", timeout: 5_000 });
  ok(true, `${how} closes the dialog while the archive is going up`);

  // Full speed again: an upload left running behind the closed dialog lands.
  context.relay.state.slow = false;
  await page.waitForTimeout(WOULD_HAVE_LANDED_MS);
  const claimed = await db
    .select({ id: issueImports.id })
    .from(issueImports)
    .where(
      and(
        eq(issueImports.adminId, context.adminId),
        gte(issueImports.createdAt, since),
      ),
    );
  // Tracked before the assertion, so a failing run still cleans up after itself.
  made.operations.push(...claimed.map((row) => row.id));
  ok(
    claimed.length === 0,
    `  …and the upload stopped with it — nothing was imported (${claimed.length})`,
  );
}
