// The export half of the issue-transfer gate (issue #293): the archive's layout
// and integrity, and the difference between an asset that is genuinely gone and
// storage refusing to answer.
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
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

  // A directory where the object should be: the read fails rather than reporting
  // absence, which is what a storage outage looks like from here.
  await mkdir(path.join(uploads, orphan.key), { recursive: true });
  const broken = await exportBundle([orphanIssue]);
  ok(
    broken.status === 500,
    `an export fails when storage cannot answer (${broken.status})`,
  );
  await rm(path.join(uploads, orphan.key), { recursive: true, force: true });

  return bundle;
}
