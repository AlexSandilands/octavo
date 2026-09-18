// Dev-only: proves issue transfer end to end (issue #293) against a running dev
// server and the local-disk storage fallback.
//
// It creates its own admin, images, sponsor, logo and issue, adopts every row an
// import writes, and removes all of them (and their objects) in the finally —
// then asserts the number of rows it did not create is exactly what it was at
// the start. It never seeds and never touches existing content.
//
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/dev-issue-transfer-gate.mts <base-url>
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "../src/db/index.ts";
import { images, sponsors } from "../src/db/schema.ts";
import type { ImportDecision } from "../src/lib/issue-transfer/decisions.ts";
import type { ImportResponse } from "../src/lib/issue-transfer/result.ts";
import { collectImageIds } from "../src/lib/images.ts";
import { getObject, listKeys, usingLocalStorage } from "../src/lib/storage.ts";
import {
  adoptNewRows,
  cleanup,
  fixtureContent,
  foreignCounts,
  made,
  makeImage,
  makeIssue,
  makeLogo,
  makeSponsor,
  rebuild,
  scratchAdmin,
  takeBaseline,
} from "./issue-transfer-fixtures.mts";
import { checkExport } from "./issue-transfer-export-checks.mts";
import {
  checkAccess,
  checkRealWorkflow,
  EDIT_MARKER,
} from "./issue-transfer-access.mts";
import {
  blankImages,
  coverLogoOf,
  imageBlocks,
  issueIdsIn,
  issueRow,
  sponsorBlockOf,
} from "./issue-transfer-probes.mts";
import { checkDisconnect } from "./issue-transfer-disconnect.mts";
import {
  checkCleanupAndRecovery,
  checkRefusals,
} from "./issue-transfer-refusals.mts";

// The project's env file is `.env`; `.env.local` wins where a checkout has one.
for (const file of [".env", ".env.local"]) {
  try {
    process.loadEnvFile?.(file);
  } catch {
    // not present
  }
}

const base = process.argv[2];
if (!base) throw new Error("usage: dev-issue-transfer-gate.mts <base-url>");
if (!usingLocalStorage()) {
  throw new Error(
    "This gate writes and deletes objects. Refusing to run against configured R2.",
  );
}

let failed = false;
const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`  ok — ${msg}`);
};
const heading = (name: string) => console.log(`\n── ${name} `.padEnd(74, "─"));
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

const origin = new URL(base).origin;
let tempDir = "";

await takeBaseline();
const startCounts = await foreignCounts();
// A site that has really imported something keeps those images under imports/.
const startKeys = new Set(await listKeys("imports/"));
console.log(`baseline (not ours): ${JSON.stringify(startCounts)}`);

try {
  tempDir = await mkdtemp(path.join(tmpdir(), "octavo-gate-"));
  const admin = await scratchAdmin();

  // ── fixtures ──────────────────────────────────────────────────────────────
  heading("fixtures");
  const crest = await makeImage(120, 90, 10);
  const photo = await makeImage(200, 150, 60);
  const slide = await makeImage(180, 120, 110);
  const poster = await makeImage(160, 90, 160);
  const sources = [crest, photo, slide, poster];
  const stamp = Date.now();
  const logoId = await makeLogo(`Gate Crest ${stamp}`, crest.id);
  const sponsorName = `Gate Sponsor ${stamp}`;
  const sponsorId = await makeSponsor(sponsorName, "https://source.example");
  const sourceTitle = `Gate Issue ${stamp}`;
  const content = fixtureContent({
    block: photo.id,
    slide: slide.id,
    poster: poster.id,
    coverLogoImage: crest.id,
    logoId,
    sponsorId,
  });
  const sourceId = await makeIssue({ title: sourceTitle, logoId, content });
  ok(
    collectImageIds(content).length === 4,
    "a scratch issue using every image-bearing site, the crest twice over",
  );

  // ── request helpers ───────────────────────────────────────────────────────
  const exportBundle = (ids: string[], cookie = admin.cookie) =>
    fetch(`${base}/api/admin/issues/export`, {
      method: "POST",
      headers: { "content-type": "application/json", origin, cookie },
      body: JSON.stringify({ ids }),
    });

  const planRequest = (cookie: string, requestOrigin = origin) =>
    fetch(`${base}/api/admin/issues/import/plan`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: requestOrigin,
        cookie,
      },
      body: JSON.stringify({
        issues: [{ id: sourceId, title: sourceTitle }],
        sponsors: [],
        logos: [],
      }),
    });

  const sendBundle = async (
    archive: Buffer,
    options: { cookie?: string; omitOrigin?: boolean } = {},
  ): Promise<ImportResponse & { status: number }> => {
    // A file with no readable manifest still needs a well-formed header: the
    // archive is refused long before the decisions are looked at.
    const listed = (await issueIdsIn(archive)) ?? [];
    if (listed.length === 0) listed.push("unreadable");
    const operationId = crypto.randomUUID();
    made.operations.push(operationId);
    const headers: Record<string, string> = {
      "content-type": "application/zip",
      cookie: options.cookie ?? admin.cookie,
      "x-issue-import": JSON.stringify({
        operationId,
        decisions: listed.map(
          (id): ImportDecision => ({ mode: "new", issueId: id }),
        ),
      }),
    };
    if (!options.omitOrigin) headers.origin = origin;
    const response = await fetch(`${base}/api/admin/issues/import`, {
      method: "POST",
      headers,
      body: new Uint8Array(archive),
    });
    const lines = (await response.text())
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const final = lines.findLast((line) => typeof line.ok === "boolean");
    return { ...(final as unknown as ImportResponse), status: response.status };
  };

  const unchangedSince = async (snapshot: Record<string, number>) => {
    await adoptNewRows();
    return JSON.stringify(await foreignCounts()) === JSON.stringify(snapshot);
  };

  const bundle = await checkExport(ok, heading, {
    base,
    stamp,
    sourceId,
    photo,
    content,
    exportBundle: (ids) => exportBundle(ids),
  });

  // ── round trip ────────────────────────────────────────────────────────────
  heading("import as new drafts");
  const first = await sendBundle(bundle);
  ok(first.ok, `the bundle imports${first.ok ? "" : `: ${first.message}`}`);
  if (!first.ok) throw new Error("import failed");
  await adoptNewRows();
  const newIssueId = first.result.issues[0]!.id;
  const imported = await issueRow(newIssueId);
  ok(imported.number === null, "the new issue has no issue number");
  ok(imported.status === "draft", "it is a draft");
  ok(imported.revision === 0, "its revision is 0");
  ok(imported.publishedAt === null, "it has no publication date");
  ok(imported.id !== sourceId, "it is a new row, not the source");
  ok(imported.logoId === logoId, "its footer mark is the matched logo");
  ok(
    first.result.sponsors[0]!.action === "reuse" &&
      first.result.logos[0]!.action === "reuse",
    "the sponsor and logo already here were reused, not duplicated",
  );
  ok(first.result.cleared.length === 0, "nothing had to be cleared");

  const fresh = await db.select().from(images);
  const written = fresh.filter(
    (row) => row.key.includes(`/`) && row.key.startsWith("imports/"),
  );
  const byHash = new Map<string, string>();
  for (const row of written) {
    const bytes = await getObject(row.key);
    if (bytes) byHash.set(sha(bytes), row.id);
  }
  ok(
    sources.every((source) => byHash.has(sha(source.bytes))),
    "each of the four photos was uploaded once, byte-identical",
  );

  const cover = coverLogoOf(imported.content);
  ok(
    cover?.logoId === logoId && cover?.imageId === crest.id,
    "the matched cover logo takes the destination logo and the destination image",
  );
  const crestBlock = imageBlocks(imported.content).find(
    (b) => b.caption === "The crest, as a photo",
  );
  ok(
    crestBlock?.imageId === byHash.get(sha(crest.bytes)),
    "while the ordinary block showing the same artwork keeps the bundled bytes",
  );
  ok(
    crestBlock?.imageId !== crest.id,
    "  …as a new image row, not the destination's",
  );
  ok(
    imageBlocks(imported.content).find((b) => b.caption === "A photo")
      ?.imageId === byHash.get(sha(photo.bytes)),
    "the ordinary photo block points at its new copy",
  );

  ok(
    JSON.stringify(blankImages(content)) ===
      JSON.stringify(blankImages(imported.content)),
    "everything but the image ids — pages, blocks, ids, text, layout, sponsor — is identical",
  );

  // ── a second import ───────────────────────────────────────────────────────
  heading("a second import of the same bundle");
  const beforeSecond = await foreignCounts();
  const second = await sendBundle(bundle);
  ok(second.ok, "it imports again under a new operation");
  if (!second.ok) throw new Error("second import failed");
  await adoptNewRows();
  ok(
    second.result.issues[0]!.id !== newIssueId,
    "creating a second copy of the issue",
  );
  const afterSecond = await foreignCounts();
  ok(
    afterSecond.sponsors === beforeSecond.sponsors &&
      afterSecond.logos === beforeSecond.logos,
    "and no new sponsors or logos",
  );

  // ── destination wins ──────────────────────────────────────────────────────
  heading("destination wins");
  const [sponsorRow] = await db
    .select()
    .from(sponsors)
    .where(eq(sponsors.id, sponsorId))
    .limit(1);
  ok(
    sponsorRow!.href === "https://source.example" &&
      sponsorRow!.name === sponsorName,
    "the matched sponsor row is untouched by the import",
  );
  const secondIssue = await issueRow(second.result.issues[0]!.id);
  ok(
    sponsorBlockOf(secondIssue.content)?.sponsorId === sponsorId,
    "and the sponsor block points at it",
  );

  // ── ambiguity ─────────────────────────────────────────────────────────────
  heading("an ambiguous library name refuses the import");
  const twinId = await makeSponsor(sponsorName.toUpperCase(), null);
  const ambiguousBaseline = await foreignCounts();
  const ambiguous = await sendBundle(bundle);
  ok(
    !ambiguous.ok && ambiguous.code === "ambiguous-library-name",
    `it is refused${ambiguous.ok ? "" : `: ${ambiguous.message}`}`,
  );
  ok(
    !ambiguous.ok && ambiguous.message.includes(sponsorName),
    "and the refusal names the entry",
  );
  ok(await unchangedSince(ambiguousBaseline), "nothing was created");
  await db.delete(sponsors).where(eq(sponsors.id, twinId));
  made.sponsors = made.sponsors.filter((id) => id !== twinId);

  // ── concurrent imports ────────────────────────────────────────────────────
  heading("two concurrent imports create a library entry once");
  const freshName = `Gate Fresh ${stamp}`;
  const freshBundle = await rebuild(bundle, (m) => {
    for (const row of m.sponsors as { name: string }[]) row.name = freshName;
    return m;
  });
  const [runA, runB] = await Promise.all([
    sendBundle(freshBundle),
    sendBundle(freshBundle),
  ]);
  await adoptNewRows();
  ok(runA.ok && runB.ok, "both imports succeed");
  const created = (await db.select().from(sponsors)).filter(
    (row) => row.name === freshName,
  );
  ok(created.length === 1, `the sponsor was created once (${created.length})`);

  // ── unresolved references ─────────────────────────────────────────────────
  heading("unresolved references are cleared, never reconnected");
  // The destination keeps rows under the very ids the bundle names, but the
  // bundle no longer supplies them — exactly what a shared pg_dump ancestry
  // produces. The references must be emptied, not quietly reconnected.
  const strippedBundle = await rebuild(bundle, (m) => ({
    ...m,
    sponsors: [],
    logos: [],
    images: [],
  }));
  const stripped = await sendBundle(strippedBundle);
  ok(stripped.ok, "the import still succeeds");
  if (!stripped.ok) throw new Error("stripped import failed");
  await adoptNewRows();
  const strippedIssue = await issueRow(stripped.result.issues[0]!.id);
  const text = JSON.stringify(strippedIssue.content);
  ok(
    !text.includes(sponsorId),
    "the sponsor id is cleared rather than left pointing at the local row",
  );
  ok(!text.includes(logoId), "the cover logo reference is cleared");
  ok(
    sources.every((source) => !text.includes(source.id)),
    "no source image id survives",
  );
  ok(strippedIssue.logoId === null, "the footer mark is cleared");
  ok(
    !strippedIssue.content.pages[1]!.blocks.some((b) => b.type === "montage"),
    "the montage, whose only slide lost its photo, is dropped",
  );
  ok(
    stripped.result.cleared.length > 0,
    `and every clearing is reported (${stripped.result.cleared
      .map((c) => `${c.kind}×${c.count}`)
      .join(", ")})`,
  );

  // ── refusals ──────────────────────────────────────────────────────────────
  heading("refusals");
  const refusalBaseline = await foreignCounts();
  await checkRefusals(
    ok,
    (archive) => sendBundle(archive),
    bundle,
    () => unchangedSince(refusalBaseline),
  );

  // ── cleanup, recovery, retry ──────────────────────────────────────────────
  heading("cleanup, recovery and retry");
  const bundleFile = path.join(tempDir, "bundle.zip");
  await writeFile(bundleFile, bundle);
  const cleanupBaseline = await foreignCounts();
  await checkCleanupAndRecovery(
    ok,
    bundleFile,
    admin.id,
    [{ mode: "new", issueId: sourceId }],
    () => unchangedSince(cleanupBaseline),
  );
  await adoptNewRows();

  // ── a client that walks away ──────────────────────────────────────────────
  heading("the import survives the browser going away");
  await checkDisconnect(ok, {
    base,
    cookie: admin.cookie,
    bundle,
    issueIds: (await issueIdsIn(bundle)) ?? [],
  });
  await adoptNewRows();

  // ── access ────────────────────────────────────────────────────────────────
  heading("only a signed-in admin, from this site");
  await checkAccess(ok, {
    base,
    adminCookie: admin.cookie,
    bundle,
    issueId: sourceId,
    exportBundle,
    planRequest,
    sendBundle,
  });

  // ── the real workflow ─────────────────────────────────────────────────────
  heading("import → edit → autosave → export → import");
  const textBlock = imported.content.pages[1]!.blocks[0]!;
  const reimportedId = await checkRealWorkflow(ok, {
    base,
    adminCookie: admin.cookie,
    issueId: newIssueId,
    textBlockId: textBlock.id,
    exportBundle: (ids) => exportBundle(ids),
    sendBundle: (archive) => sendBundle(archive),
  });
  if (!reimportedId) throw new Error("re-import failed");
  await adoptNewRows();
  // The editor stores body text as a rich-text document, so the words are
  // looked for rather than compared against a string.
  const savedBlock = (await issueRow(reimportedId)).content.pages[1]!
    .blocks[0]!;
  ok(
    savedBlock.type === "text" &&
      JSON.stringify(savedBlock.text).includes(EDIT_MARKER),
    "carrying the edit across",
  );

  heading("nothing else moved");
  await adoptNewRows();
  const finalCounts = await foreignCounts();
  ok(
    JSON.stringify(finalCounts) === JSON.stringify(startCounts),
    `rows this run did not create are unchanged (${JSON.stringify(finalCounts)})`,
  );
  const stray = (await listKeys("imports/")).filter(
    (key) => !made.keys.includes(key) && !startKeys.has(key),
  );
  ok(
    stray.length === 0,
    `no import left an object behind (${stray.slice(0, 3).join(", ")})`,
  );
} catch (err) {
  failed = true;
  console.error(err instanceof Error ? err.message : err);
} finally {
  await cleanup();
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
}

console.log(failed ? "\nFAILED" : "\nAll issue-transfer gate checks passed.");
process.exit(failed ? 1 : 0);
