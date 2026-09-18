// Production-build check for issue transfer's two size cases (issue #293): a
// bundle over 10 MB — the point where Next's proxy would silently truncate a
// body it buffered, which is why the import path is excluded from the matcher —
// and one near a representative upper bound for a club's archive.
//
// It needs a real production server and working storage. `next start` refuses to
// boot in production without R2 (src/lib/env.ts), so it uses the same local S3
// substitute and preloader the PDF-import production gates do
// (docs/pdf-import.md):
//
//   npx tsx scripts/pdf-import-s3-server.mts &
//   npm run build
//   export NODE_OPTIONS="--import $PWD/scripts/pdf-import-s3-preload.mjs"
//   export R2_ACCOUNT_ID=octavo223 R2_ACCESS_KEY_ID=local-test \
//     R2_SECRET_ACCESS_KEY=local-test R2_BUCKET=octavo223 \
//     R2_PUBLIC_URL=http://127.0.0.1:19923 EMAIL_API_KEY=local-test
//   npx next start -p 3293
//   npx tsx --tsconfig scripts/tsconfig.json scripts/prod-issue-transfer-size.mts http://localhost:3293
import { createHash } from "node:crypto";
import sharp from "sharp";
import { CONTENT_VERSION } from "../src/lib/blocks.ts";
import type { ImportDecision } from "../src/lib/issue-transfer/decisions.ts";
import type { ImportResponse } from "../src/lib/issue-transfer/result.ts";
import {
  adoptNewRows,
  cleanup,
  foreignCounts,
  scratchAdmin,
  takeBaseline,
  writeZip,
  type ZipEntry,
} from "./issue-transfer-fixtures.mts";

for (const file of [".env", ".env.local"]) {
  try {
    process.loadEnvFile?.(file);
  } catch {
    // not present
  }
}

const base = process.argv[2];
if (!base) throw new Error("usage: prod-issue-transfer-size.mts <base-url>");
const origin = new URL(base).origin;

let failed = false;
const ok = (cond: unknown, msg: string) => {
  if (!cond) {
    failed = true;
    console.error(`FAIL: ${msg}`);
    return;
  }
  console.log(`  ok — ${msg}`);
};
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const mb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

// Noise compresses badly, which is the point: a handful of these reaches ten
// megabytes without a hundred files. The same bytes are listed under several
// ids, so generating them is quick.
async function noisyWebp(edge: number): Promise<Buffer> {
  const pixels = Buffer.alloc(edge * edge * 3);
  for (let i = 0; i < pixels.length; i += 1)
    pixels[i] = (Math.random() * 256) | 0;
  return sharp(pixels, { raw: { width: edge, height: edge, channels: 3 } })
    .webp({ quality: 92 })
    .toBuffer();
}

async function buildBundle(issues: number, imagesPerIssue: number) {
  const distinct = await Promise.all([
    noisyWebp(1200),
    noisyWebp(1100),
    noisyWebp(1000),
  ]);
  const entries: ZipEntry[] = [];
  const manifest = {
    format: "octavo-issues",
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    contentVersion: CONTENT_VERSION,
    issues: [] as unknown[],
    images: [] as unknown[],
    sponsors: [],
    logos: [],
  };
  const ids: string[] = [];

  for (let i = 0; i < issues; i += 1) {
    const imageIds: string[] = [];
    for (let j = 0; j < imagesPerIssue; j += 1) {
      const bytes = distinct[(i + j) % distinct.length]!;
      const id = crypto.randomUUID();
      imageIds.push(id);
      const meta = await sharp(bytes).metadata();
      manifest.images.push({
        id,
        file: `images/${id}.webp`,
        width: meta.width,
        height: meta.height,
        bytes: bytes.length,
        sha256: sha(bytes),
      });
      entries.push({ name: `images/${id}.webp`, bytes, store: true });
    }
    const issueId = crypto.randomUUID();
    ids.push(issueId);
    const document = Buffer.from(
      JSON.stringify({
        title: `Size check ${i + 1} — ${Date.now()}`,
        theme: "classic",
        content: {
          version: CONTENT_VERSION,
          pages: [
            { id: crypto.randomUUID(), cover: true, blocks: [] },
            {
              id: crypto.randomUUID(),
              blocks: imageIds.map((imageId) => ({
                id: crypto.randomUUID(),
                type: "image",
                imageId,
                caption: "",
                align: "full",
                width: 100,
              })),
            },
          ],
        },
        footerMarkSize: 27,
        footerTextSize: 10,
        logoId: null,
        number: null,
        status: "draft",
        publishedAt: null,
      }),
      "utf8",
    );
    manifest.issues.push({
      id: issueId,
      file: `issues/${issueId}/issue.json`,
      title: `Size check ${i + 1}`,
      bytes: document.length,
      sha256: sha(document),
    });
    entries.push({
      name: `issues/${issueId}/issue.json`,
      bytes: document,
      store: false,
    });
  }

  const archive = await writeZip([
    {
      name: "manifest.json",
      bytes: Buffer.from(JSON.stringify(manifest), "utf8"),
      store: false,
    },
    ...entries,
  ]);
  return { archive, ids };
}

await takeBaseline();
const before = await foreignCounts();

try {
  const admin = await scratchAdmin();

  const send = async (archive: Buffer, ids: string[]) => {
    const response = await fetch(`${base}/api/admin/issues/import`, {
      method: "POST",
      headers: {
        "content-type": "application/zip",
        origin,
        cookie: admin.cookie,
        "x-issue-import": JSON.stringify({
          operationId: crypto.randomUUID(),
          decisions: ids.map(
            (id): ImportDecision => ({ mode: "new", issueId: id }),
          ),
        }),
      },
      body: new Uint8Array(archive),
    });
    const lines = (await response.text())
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    return lines.findLast((line) => typeof line.ok === "boolean") as unknown as
      | ImportResponse
      | undefined;
  };

  // 10 MB is Next's proxy buffering limit: past it a proxied body is truncated
  // in silence, so the first case has to clear it comfortably.
  for (const [label, issues, perIssue, atLeast] of [
    ["over ten megabytes", 4, 4, 10 * 1024 * 1024],
    ["a representative upper bound", 20, 4, 50 * 1024 * 1024],
  ] as const) {
    const { archive, ids } = await buildBundle(issues, perIssue);
    console.log(`\n── ${label}: ${mb(archive.length)}, ${ids.length} issues`);
    ok(archive.length > atLeast, `the bundle really is over ${mb(atLeast)}`);
    const started = Date.now();
    const result = await send(archive, ids);
    ok(
      result?.ok === true,
      `imported in ${((Date.now() - started) / 1000).toFixed(1)}s` +
        (result?.ok ? "" : ` — ${result?.message ?? "no response"}`),
    );
    if (result?.ok) {
      ok(
        result.result.issues.length === ids.length,
        `${result.result.issues.length} drafts created`,
      );
    }
  }

  await adoptNewRows();
  const after = await foreignCounts();
  ok(
    JSON.stringify(after) === JSON.stringify(before),
    `rows this run did not create are unchanged (${JSON.stringify(after)})`,
  );
} catch (err) {
  failed = true;
  console.error(err);
} finally {
  await cleanup();
}

console.log(failed ? "\nFAILED" : "\nSize checks passed.");
process.exit(failed ? 1 : 0);
