// The refusal battery and the cleanup/recovery half of the issue-transfer gate
// (issue #293), kept out of the gate itself so both stay readable.
//
// The refusals go through the real HTTP route. Cleanup and recovery drive
// `importBundle` in process instead: they need a failure injected *partway
// through the object writes*, which no valid request can cause — the seam is an
// environment variable the server process is started with, and it is ignored
// outside development (src/server/issue-transfer/fault.ts).
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../src/db/index.ts";
import { issueImports } from "../src/db/schema.ts";
import { CONTENT_VERSION } from "../src/lib/blocks.ts";
import type { ImportDecision } from "../src/lib/issue-transfer/decisions.ts";
import { importBundle } from "../src/server/issue-transfer/import.ts";
import { importPrefix } from "../src/server/issue-transfer/operations.ts";
import { listKeys } from "../src/lib/storage.ts";
import {
  made,
  readZipEntries,
  rebuild,
  writeZip,
  writeZipDuplicating,
} from "./issue-transfer-fixtures.mts";

type Ok = (cond: unknown, msg: string) => void;
type Send = (
  archive: Buffer,
  options?: { operationId?: string },
) => Promise<{ ok: boolean; code?: string; message?: string }>;

export async function checkRefusals(
  ok: Ok,
  send: Send,
  bundle: Buffer,
  rowsUnchanged: () => Promise<boolean>,
): Promise<void> {
  const cases: [string, () => Promise<Buffer>, string][] = [
    [
      "a file that is not a zip at all",
      async () => Buffer.from("this is not a zip", "utf8"),
      "not-a-bundle",
    ],
    [
      "a zip with no manifest",
      async () =>
        writeZip([
          { name: "readme.txt", bytes: Buffer.from("hi"), store: false },
        ]),
      "not-a-bundle",
    ],
    [
      "an entry named ../ that the manifest points at",
      async () =>
        rebuild(bundle, (manifest) => {
          const issues = manifest.issues as { file: string }[];
          issues[0]!.file = "../../../etc/passwd";
          return manifest;
        }),
      "not-a-bundle",
    ],
    [
      "an entry bigger than it declares",
      async () =>
        rebuild(bundle, (manifest) => {
          const issues = manifest.issues as { bytes: number }[];
          issues[0]!.bytes = 8;
          return manifest;
        }),
      "damaged",
    ],
    [
      "a file whose hash does not match",
      async () =>
        rebuild(bundle, (manifest) => {
          const issues = manifest.issues as { sha256: string }[];
          issues[0]!.sha256 = "0".repeat(64);
          return manifest;
        }),
      "damaged",
    ],
    [
      "a listed file that is not in the archive",
      async () => {
        const entries = await readManifest(bundle);
        return rebuild(bundle, () => undefined, [], [entries.issues[0]!.file]);
      },
      "missing-file",
    ],
    [
      "the same issue listed twice",
      async () =>
        rebuild(bundle, (manifest) => {
          const issues = manifest.issues as unknown[];
          issues.push({ ...(issues[0] as object) });
          return manifest;
        }),
      "duplicate-id",
    ],
    [
      "a manifest from a newer format",
      async () =>
        rebuild(bundle, (manifest) => ({ ...manifest, formatVersion: 2 })),
      "format-too-new",
    ],
    [
      "a document whose own version is newer than this site's",
      async () => {
        const entries = await readManifest(bundle);
        return rewriteDocument(bundle, entries.issues[0]!.id, (doc) => {
          doc.content.version = CONTENT_VERSION + 1;
          return doc;
        });
      },
      "content-too-new",
    ],
    [
      "a document too big to stay savable",
      async () => {
        const entries = await readManifest(bundle);
        return rewriteDocument(bundle, entries.issues[0]!.id, (doc) => {
          doc.content.pages = Array.from({ length: 150 }, (_, i) => ({
            id: `p-${i}`,
            blocks: Array.from({ length: 90 }, (_, j) => ({
              id: `p-${i}-b-${j}`,
              type: "text",
              text: "y".repeat(280),
            })),
          }));
          return doc;
        });
      },
      "document-too-large",
    ],
    [
      "a document repeating a page id",
      async () => {
        const entries = await readManifest(bundle);
        return rewriteDocument(bundle, entries.issues[0]!.id, (doc) => {
          const pages = doc.content.pages as { id: string }[];
          pages[1]!.id = pages[0]!.id;
          return doc;
        });
      },
      "duplicate-document-id",
    ],
    [
      "a photo that does not decode",
      async () => {
        const entries = await readManifest(bundle);
        const image = entries.images[0]!;
        const bytes = Buffer.alloc(image.bytes, 7);
        return rebuild(
          bundle,
          (manifest) => {
            const list = manifest.images as { id: string; sha256: string }[];
            const target = list.find((i) => i.id === image.id)!;
            target.sha256 = sha(bytes);
            return manifest;
          },
          [{ name: image.file, bytes, store: true }],
          [image.file],
        );
      },
      "bad-image",
    ],
    [
      "a photo whose size disagrees with the manifest",
      async () =>
        rebuild(bundle, (manifest) => {
          const list = manifest.images as { width: number }[];
          list[0]!.width += 1;
          return manifest;
        }),
      "bad-image",
    ],
    [
      "an archive holding two entries under one listed name",
      async () => {
        const manifest = await readManifest(bundle);
        return duplicateEntry(bundle, manifest.issues[0]!.file);
      },
      "not-a-bundle",
    ],
    [
      "an archive holding two manifests",
      async () => duplicateEntry(bundle, "manifest.json"),
      "not-a-bundle",
    ],
  ];

  for (const [label, build, code] of cases) {
    const response = await send(await build());
    ok(
      !response.ok && response.code === code,
      `${label} is refused (${response.code}: ${response.message ?? ""})`,
    );
    ok(await rowsUnchanged(), `  …and nothing was created`);
  }
}

export async function checkCleanupAndRecovery(
  ok: Ok,
  file: string,
  adminId: string,
  decisions: ImportDecision[],
  rowsUnchanged: () => Promise<boolean>,
): Promise<void> {
  const run = async (fault: string | undefined, operationId: string) => {
    made.operations.push(operationId);
    if (fault) process.env.ISSUE_TRANSFER_FAULT = fault;
    else delete process.env.ISSUE_TRANSFER_FAULT;
    try {
      return await importBundle({ file, adminId, operationId, decisions });
    } finally {
      delete process.env.ISSUE_TRANSFER_FAULT;
    }
  };
  const statusOf = async (id: string) => {
    const [row] = await db
      .select({ status: issueImports.status })
      .from(issueImports)
      .where(eq(issueImports.id, id))
      .limit(1);
    return row?.status ?? null;
  };
  const objects = (id: string) => listKeys(importPrefix(id));

  const partway = crypto.randomUUID();
  const first = await run("objects", partway);
  ok(!first.ok, "a failure partway through the object writes fails the import");
  ok((await objects(partway)).length === 0, "  …and the prefix is empty");
  ok(await rowsUnchanged(), "  …and nothing was created");
  ok((await statusOf(partway)) === "swept", "  …and the operation is closed");

  const inCommit = crypto.randomUUID();
  const second = await run("transaction", inCommit);
  ok(!second.ok, "a failure inside the transaction fails the import");
  ok((await objects(inCommit)).length === 0, "  …and the prefix is empty");
  ok(await rowsUnchanged(), "  …and nothing was created");
  ok((await statusOf(inCommit)) === "swept", "  …and the operation is closed");

  // Storage refusing to delete as well: the row deliberately stays `started`,
  // which is what the sweep later finds.
  const stranded = crypto.randomUUID();
  const third = await run("transaction,cleanup", stranded);
  ok(!third.ok, "a commit failure with cleanup also failing still refuses");
  ok(
    (await statusOf(stranded)) === "started",
    "  …and the operation stays started, so recovery can find it",
  );
  const leaked = await objects(stranded);
  ok(
    leaked.length > 0,
    `  …with its objects still in storage (${leaked.length})`,
  );
  for (const key of leaked) made.keys.push(key);

  // Age it past the guard, then let the next import sweep it.
  await db
    .update(issueImports)
    .set({ createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) })
    .where(eq(issueImports.id, stranded));
  const sweeper = crypto.randomUUID();
  const fourth = await run(undefined, sweeper);
  ok(fourth.ok, "the next import runs the sweep and succeeds");
  ok(
    (await objects(stranded)).length === 0,
    "  …and the stranded attempt's objects are gone",
  );
  ok(
    (await statusOf(stranded)) === "swept",
    "  …and its record is marked swept",
  );

  // A commit whose acknowledgement never came back: the rows are in, so the
  // objects they point at must survive and the recorded result is the answer.
  const lostAck = crypto.randomUUID();
  const fifth = await run("post-commit", lostAck);
  ok(
    fifth.ok && fifth.retried === true,
    `a lost commit acknowledgement returns the committed result${fifth.ok ? "" : `: ${fifth.message}`}`,
  );
  ok(
    (await statusOf(lostAck)) === "committed",
    "  …and the operation stays committed",
  );
  const kept = await objects(lostAck);
  ok(
    kept.length > 0,
    `  …and its images are still in storage (${kept.length})`,
  );
  for (const key of kept) made.keys.push(key);

  if (fourth.ok) {
    const retry = await importBundle({
      file,
      adminId,
      operationId: sweeper,
      decisions,
    });
    ok(
      retry.ok &&
        retry.retried === true &&
        JSON.stringify(retry.result.issues) ===
          JSON.stringify(fourth.result.issues),
      "the same operation id again returns the recorded result",
    );
  }
}

// ── small helpers ───────────────────────────────────────────────────────────

type ManifestShape = {
  issues: { id: string; file: string }[];
  images: { id: string; file: string; bytes: number }[];
};

// The same archive with a second, different entry under `name` — what a zip
// parser differential would feed on.
async function duplicateEntry(bundle: Buffer, name: string): Promise<Buffer> {
  const entries = await readZipEntries(bundle);
  return writeZipDuplicating(
    entries.map((entry) => ({
      name: entry.name,
      bytes: entry.bytes,
      store: entry.name.startsWith("images/"),
    })),
    name,
    Buffer.from("{}", "utf8"),
  );
}

async function readManifest(bundle: Buffer): Promise<ManifestShape> {
  const entries = await readZipEntries(bundle);
  const manifest = entries.find((e) => e.name === "manifest.json")!;
  return JSON.parse(manifest.bytes.toString("utf8")) as ManifestShape;
}

async function rewriteDocument(
  bundle: Buffer,
  issueId: string,
  edit: (doc: { content: { version: number; pages: unknown[] } }) => {
    content: { version: number; pages: unknown[] };
  },
): Promise<Buffer> {
  const entries = await readZipEntries(bundle);
  const file = `issues/${issueId}/issue.json`;
  const original = entries.find((e) => e.name === file)!;
  const edited = Buffer.from(
    JSON.stringify(edit(JSON.parse(original.bytes.toString("utf8")))),
    "utf8",
  );
  return rebuild(
    bundle,
    (manifest) => {
      const list = manifest.issues as {
        id: string;
        bytes: number;
        sha256: string;
      }[];
      const target = list.find((i) => i.id === issueId)!;
      target.bytes = edited.length;
      target.sha256 = sha(edited);
      return manifest;
    },
    [{ name: file, bytes: edited, store: false }],
    [file],
  );
}

function sha(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
