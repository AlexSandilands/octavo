// The export half of the issue-transfer gate (issue #293): the archive's layout
// and integrity, and the difference between an asset that is genuinely gone and
// storage refusing to answer.
import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../src/db/index.ts";
import { images } from "../src/db/schema.ts";
import type { IssueContent } from "../src/lib/blocks.ts";
import {
  makeImage,
  makeIssue,
  readZipEntries,
} from "./issue-transfer-fixtures.mts";

type Ok = (cond: unknown, msg: string) => void;
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

/** Exports the scratch issue, checks the archive, and hands it back for the
 *  import half to use. */
export async function checkExport(
  ok: Ok,
  heading: (name: string) => void,
  context: {
    base: string;
    stamp: number;
    sourceId: string;
    photo: { id: string; key: string; bytes: Buffer };
    content: IssueContent;
    exportBundle: (ids: string[]) => Promise<Response>;
  },
): Promise<Buffer> {
  const { exportBundle, sourceId, photo } = context;
  // ── the archive ────────────────────────────────────────────────────────────────
  heading("export");
  const exported = await exportBundle([sourceId]);
  ok(exported.status === 200, "an admin can export the selection");
  ok(
    exported.headers.get("content-type") === "application/zip",
    "the response is a zip",
  );
  ok(
    /attachment; filename="octavo-issues-\d{4}-\d{2}-\d{2}\.zip"/.test(
      exported.headers.get("content-disposition") ?? "",
    ),
    `it downloads under a plain name (${exported.headers.get("content-disposition")})`,
  );
  ok(
    exported.headers.get("x-issue-export-omitted") === "{}",
    "nothing was left out",
  );
  const bundle = Buffer.from(await exported.arrayBuffer());
  const entries = await readZipEntries(bundle);
  const manifest = JSON.parse(
    entries.find((e) => e.name === "manifest.json")!.bytes.toString("utf8"),
  );
  ok(manifest.format === "octavo-issues", "the manifest names the format");
  ok(
    manifest.issues.length === 1 && manifest.images.length === 4,
    `it lists one issue and four photos (${manifest.images.length})`,
  );
  ok(
    manifest.sponsors.length === 1 && manifest.logos.length === 1,
    "and the sponsor and logo the issue references",
  );
  ok(
    entries.every(
      (e) =>
        e.name === "manifest.json" ||
        e.name === `issues/${sourceId}/issue.json` ||
        /^images\/[^/]+\.webp$/.test(e.name),
    ),
    "every entry uses one of the documented paths",
  );
  ok(
    entries
      .filter((e) => e.name.startsWith("images/"))
      .every((e) => e.method === 0),
    "photos are stored, not deflated",
  );
  ok(
    manifest.images.every(
      (image: { file: string; bytes: number; sha256: string }) => {
        const entry = entries.find((e) => e.name === image.file)!;
        return (
          entry.bytes.length === image.bytes &&
          sha(entry.bytes) === image.sha256
        );
      },
    ),
    "every listed file's size and hash match its bytes",
  );
  ok(
    entries
      .find((e) => e.name === `images/${photo.id}.webp`)!
      .bytes.equals(photo.bytes),
    "the exported photo is byte-identical to the stored object",
  );

  // ── missing vs failing ────────────────────────────────────────────────────
  heading("an absent object is omitted; storage refusing to answer fails");
  const orphan = await makeImage(80, 60, 200);
  const orphanIssue = await makeIssue({
    title: `Gate Orphan ${context.stamp}`,
    logoId: null,
    content: {
      version: context.content.version,
      pages: [
        { id: crypto.randomUUID(), cover: true, blocks: [] },
        {
          id: crypto.randomUUID(),
          blocks: [
            {
              id: crypto.randomUUID(),
              type: "image",
              imageId: orphan.id,
              caption: "",
              align: "full",
              width: 100,
            },
          ],
        },
      ],
    },
  });
  const uploads = path.join(process.cwd(), ".data", "uploads");
  await rm(path.join(uploads, orphan.key));
  const withGap = await exportBundle([orphanIssue]);
  ok(withGap.status === 200, "an export whose photo has gone still downloads");
  ok(
    withGap.headers.get("x-issue-export-omitted") === '{"image":1}',
    `and reports what it left out (${withGap.headers.get("x-issue-export-omitted")})`,
  );
  const gapped = await readZipEntries(Buffer.from(await withGap.arrayBuffer()));
  ok(
    !gapped.some((e) => e.name.startsWith("images/")),
    "the missing photo is not listed and not carried",
  );

  // An unreadable object: storage answers with an error rather than an absence,
  // which the export must refuse rather than quietly ship a bundle with a hole.
  const unreadable = path.join(uploads, orphan.key);
  await writeFile(unreadable, Buffer.from("x"));
  await chmod(unreadable, 0o000);
  const broken = await exportBundle([orphanIssue]);
  ok(
    broken.status === 500,
    `an export fails when storage cannot answer (${broken.status})`,
  );
  await chmod(unreadable, 0o600);
  await rm(unreadable, { force: true });

  // A directory where an object should be is an absence, not a failure — the
  // image-serving route passes request-supplied keys through the same read.
  await mkdir(path.join(uploads, "gate-dir-probe", "inner"), {
    recursive: true,
  });
  const served = await fetch(`${context.base}/api/images/gate-dir-probe`);
  ok(
    served.status === 404,
    `a key naming a directory is served as 404, not 500 (${served.status})`,
  );
  await rm(path.join(uploads, "gate-dir-probe"), {
    recursive: true,
    force: true,
  });

  // ── a photo whose row never recorded its size ─────────────────────────────
  heading("an image row with no recorded dimensions still exports");
  const sizeless = await makeImage(64, 48, 90);
  await db
    .update(images)
    .set({ width: null, height: null })
    .where(eq(images.id, sizeless.id));
  const sizelessIssue = await makeIssue({
    title: `Gate Sizeless ${context.stamp}`,
    logoId: null,
    content: {
      version: context.content.version,
      pages: [
        { id: crypto.randomUUID(), cover: true, blocks: [] },
        {
          id: crypto.randomUUID(),
          blocks: [
            {
              id: crypto.randomUUID(),
              type: "image",
              imageId: sizeless.id,
              caption: "",
              align: "full",
              width: 100,
            },
          ],
        },
      ],
    },
  });
  const sized = await exportBundle([sizelessIssue]);
  ok(sized.status === 200, "it exports");
  const sizedEntries = await readZipEntries(
    Buffer.from(await sized.arrayBuffer()),
  );
  const sizedManifest = JSON.parse(
    sizedEntries
      .find((e) => e.name === "manifest.json")!
      .bytes.toString("utf8"),
  ) as { images: { width: number; height: number }[] };
  ok(
    sizedManifest.images[0]?.width === 64 &&
      sizedManifest.images[0]?.height === 48,
    `with the real size read from the bytes (${sizedManifest.images[0]?.width}×${sizedManifest.images[0]?.height})`,
  );

  return bundle;
}
