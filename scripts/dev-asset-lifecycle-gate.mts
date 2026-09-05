// Dev-only: verifies the asset lifecycle (issue #84) — that deleting an issue,
// a sponsor or a logo takes its now-unreferenced images out of the database AND
// out of storage, and that everything still referenced stays put.
//
// It drives the real server functions (server/issues.ts, server/sponsors.ts,
// server/logos.ts) in process rather than a browser: the interesting behaviour
// is the reference scan and the commit-then-sweep ordering, none of which a UI
// click can distinguish. That needs Next's two module resolutions, so run it as:
//
//   npx tsx --tsconfig scripts/tsconfig.json scripts/dev-asset-lifecycle-gate.mts
//
// SAFETY: it writes to the shared dev database. Every row it touches is one it
// created in this run, tracked by id and removed in the finally — it never
// matches on names or patterns, and it asserts at the end that the number of
// rows it did not create is exactly what it was at the start. A failed run
// cleans up the same way a passing one does.
//
// Storage here is the local-disk fallback (.data/uploads), so "the object is
// gone" is a real file assertion. The R2 half of the facade is the same call
// through the same interface and is NOT exercised — verify that against a real
// bucket separately.
//
// Expect one noisy line in the storage-failure section: outside Next,
// `@sentry/nextjs` resolves to a build with no captureException, so the sweep's
// own report fails and says so. That is this script's environment, not the
// app's — and the run proving the delete survives even that is the point.
import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { count, eq, inArray, notInArray } from "drizzle-orm";
import { db } from "../src/db";
import { images, issues, logos, sponsors } from "../src/db/schema";
import {
  CONTENT_VERSION,
  type Block,
  type IssueContent,
  type Page,
} from "../src/lib/blocks";
import { createId } from "../src/lib/id";
import {
  deleteByPrefix,
  getObject,
  listKeys,
  putObject,
  usingLocalStorage,
} from "../src/lib/storage";
import { createImageRecord } from "../src/server/images";
import {
  createIssue,
  deleteIssue,
  updateIssueContent,
} from "../src/server/issues";
import { createLogo, deleteLogo } from "../src/server/logos";
import { createSponsor, deleteSponsor } from "../src/server/sponsors";

process.loadEnvFile?.(".env.local");

const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
};

if (!usingLocalStorage()) {
  throw new Error(
    "This gate deletes objects. Refusing to run against configured R2 — " +
      "unset the R2_* vars so it uses the local-disk fallback.",
  );
}

// Everything this run creates, so the finally can remove exactly that and
// nothing else. Ids only — never a name or a prefix.
const made = {
  issues: [] as string[],
  images: [] as string[],
  sponsors: [] as string[],
  logos: [] as string[],
  keys: [] as string[],
  dirs: [] as string[],
};

// The shipped footer reserve in px (issue #216): the medium presets.
const RESERVE = { footerMarkSize: 27, footerTextSize: 10 } as const;
const UPLOADS = path.join(process.cwd(), ".data", "uploads");

// Rows that existed before this run. Asserted unchanged at the end — the one
// check that catches a scan or a delete reaching past the fixtures into the
// owner's real content.
async function foreignCounts() {
  const [i] = await db
    .select({ n: count() })
    .from(issues)
    .where(made.issues.length ? notInArray(issues.id, made.issues) : undefined);
  const [m] = await db
    .select({ n: count() })
    .from(images)
    .where(made.images.length ? notInArray(images.id, made.images) : undefined);
  const [s] = await db
    .select({ n: count() })
    .from(sponsors)
    .where(
      made.sponsors.length ? notInArray(sponsors.id, made.sponsors) : undefined,
    );
  const [l] = await db
    .select({ n: count() })
    .from(logos)
    .where(made.logos.length ? notInArray(logos.id, made.logos) : undefined);
  return {
    issues: i?.n ?? 0,
    images: m?.n ?? 0,
    sponsors: s?.n ?? 0,
    logos: l?.n ?? 0,
  };
}
const before = await foreignCounts();
console.log(
  `baseline (not ours): ${before.issues} issues, ${before.images} images, ` +
    `${before.sponsors} sponsors, ${before.logos} logos`,
);

// ── fixtures ────────────────────────────────────────────────────────────────

async function newIssue(): Promise<string> {
  const issue = await createIssue(RESERVE);
  made.issues.push(issue.id);
  return issue.id;
}

// An image the way an upload makes one: real bytes at a real key, plus the row.
// `issueId` is the upload provenance the route records, deliberately set on
// images that end up placed elsewhere so the gate proves the scan — not the
// column — decides what survives.
async function newImage(issueId: string | null): Promise<string> {
  const key = issueId
    ? `issues/${issueId}/${createId()}.webp`
    : `images/${createId()}.webp`;
  await putObject(key, Buffer.from(`bytes ${key}`), "image/webp");
  made.keys.push(key);
  const row = await createImageRecord({ key, width: 8, height: 8, issueId });
  made.images.push(row.id);
  return row.id;
}

const imageBlock = (imageId: string): Block => ({
  id: createId(),
  type: "image",
  imageId,
  caption: "",
  align: "full",
  width: 100,
});

const videoBlock = (posterImageId: string): Block => ({
  id: createId(),
  type: "video",
  provider: "youtube",
  posterImageId,
  caption: "",
  align: "full",
  width: 100,
});

const montageBlock = (imageId: string): Block => ({
  id: createId(),
  type: "montage",
  items: [{ imageId, alt: "" }],
  caption: "",
  interval: 5,
  align: "full",
  width: 100,
});

// Replace an issue's content with one page holding these blocks. Goes through
// updateIssueContent, the save path itself, so `revision` moves as it really
// would (the fixtures are written at revision 0, straight after createIssue).
async function setBlocks(issueId: string, blocks: Block[]): Promise<void> {
  const page: Page = { id: createId(), cover: true, blocks };
  const content: IssueContent = { version: CONTENT_VERSION, pages: [page] };
  const result = await updateIssueContent(issueId, content, 0);
  if (!result.ok) throw new Error(`fixture save failed: ${result.reason}`);
}

const imageRowExists = async (id: string) =>
  (await db.select({ id: images.id }).from(images).where(eq(images.id, id)))
    .length > 0;
const bytesExist = async (key: string) => (await getObject(key)) !== null;

// Every fixture image, remembered with its key so both halves ("the row went",
// "the bytes went") can be asserted after the row is no longer there to ask.
const keyOf = new Map<string, string>();
async function fixtureImage(issueId: string | null): Promise<string> {
  const id = await newImage(issueId);
  const [row] = await db
    .select({ key: images.key })
    .from(images)
    .where(eq(images.id, id));
  keyOf.set(id, row!.key);
  return id;
}

async function assertGone(label: string, id: string) {
  ok(!(await imageRowExists(id)), `${label}: images row deleted`);
  ok(!(await bytesExist(keyOf.get(id)!)), `${label}: stored object deleted`);
}
async function assertKept(label: string, id: string) {
  ok(await imageRowExists(id), `${label}: images row kept`);
  ok(await bytesExist(keyOf.get(id)!), `${label}: stored object kept`);
}

let failed = false;
try {
  // ── 1. Deleting an issue ──────────────────────────────────────────────────
  const issueA = await newIssue(); // deleted below
  const issueB = await newIssue(); // the bystander that holds references

  const onlyA = await fixtureImage(issueA);
  const sharedAB = await fixtureImage(issueA);
  const sponsorMark = await fixtureImage(issueA);
  const clubMark = await fixtureImage(issueA);
  const posterOnlyA = await fixtureImage(issueA);
  const posterShared = await fixtureImage(issueA);
  const montageOnlyA = await fixtureImage(issueA);
  const neverPlaced = await fixtureImage(issueA); // uploaded, never put on a page
  const onlyB = await fixtureImage(null);

  await setBlocks(issueA, [
    imageBlock(onlyA),
    imageBlock(sharedAB),
    imageBlock(sponsorMark),
    imageBlock(clubMark),
    videoBlock(posterOnlyA),
    videoBlock(posterShared),
    montageBlock(montageOnlyA),
  ]);
  await setBlocks(issueB, [
    imageBlock(sharedAB),
    videoBlock(posterShared),
    imageBlock(onlyB),
  ]);

  const sponsorS1 = await createSponsor({
    name: "Gate Sponsor One",
    href: null,
    logoId: sponsorMark,
    activeUntil: null,
  });
  made.sponsors.push(sponsorS1);
  const logoL1 = await createLogo({ name: "Gate Mark One", imageId: clubMark });
  made.logos.push(logoL1);

  // Cached PDFs: the deleted issue's folder, and a bystander's that must not be
  // touched by a prefix sweep.
  const pdfA = `pdfs/${issueA}/1-classic-nologo-abcdef-v8.pdf`;
  const pdfA2 = `pdfs/${issueA}/2-modern-nologo-abcdef-v8.pdf`;
  const pdfB = `pdfs/${issueB}/1-classic-nologo-abcdef-v8.pdf`;
  for (const key of [pdfA, pdfA2, pdfB]) {
    await putObject(key, Buffer.from("%PDF-1.4 gate"), "application/pdf");
    made.keys.push(key);
  }
  ok(
    (await listKeys(`pdfs/${issueA}/`)).length === 2,
    "fixture: two cached PDFs under the issue's prefix",
  );

  await deleteIssue(issueA);

  const [goneA] = await db
    .select({ id: issues.id })
    .from(issues)
    .where(eq(issues.id, issueA));
  ok(!goneA, "the issue row is deleted");

  await assertGone("image placed only on the deleted issue", onlyA);
  await assertGone("video poster only on the deleted issue", posterOnlyA);
  await assertGone("montage slide only on the deleted issue", montageOnlyA);
  await assertGone("image uploaded under it but never placed", neverPlaced);

  await assertKept("image also placed in another issue", sharedAB);
  await assertKept("video poster also placed in another issue", posterShared);
  await assertKept("image that is a sponsor's logo", sponsorMark);
  await assertKept("image that is a club logo's mark", clubMark);
  await assertKept("image belonging to another issue entirely", onlyB);

  ok(
    (await listKeys(`pdfs/${issueA}/`)).length === 0,
    "cached PDFs under the deleted issue's prefix are gone",
  );
  ok(
    (await getObject(pdfB)) !== null,
    "another issue's cached PDF is untouched by the prefix sweep",
  );

  const [keptSponsor] = await db
    .select({ logoId: sponsors.logoId })
    .from(sponsors)
    .where(eq(sponsors.id, sponsorS1));
  ok(keptSponsor?.logoId === sponsorMark, "the sponsor still holds its logo");
  const [keptLogo] = await db
    .select({ imageId: logos.imageId })
    .from(logos)
    .where(eq(logos.id, logoL1));
  ok(keptLogo?.imageId === clubMark, "the club logo still holds its mark");

  // ── 2. Deleting a sponsor ─────────────────────────────────────────────────
  const sponsorOnly = await fixtureImage(null);
  const sponsorS2 = await createSponsor({
    name: "Gate Sponsor Two",
    href: null,
    logoId: sponsorOnly,
    activeUntil: null,
  });
  made.sponsors.push(sponsorS2);
  await deleteSponsor(sponsorS2);
  await assertGone("sponsor's own logo image", sponsorOnly);

  const sponsorS3 = await createSponsor({
    name: "Gate Sponsor Three",
    href: null,
    logoId: sharedAB, // still on issue B's pages
    activeUntil: null,
  });
  made.sponsors.push(sponsorS3);
  await deleteSponsor(sponsorS3);
  await assertKept("sponsor logo an issue still shows", sharedAB);

  // S1's mark is now referenced by nothing else — the delete takes it.
  await deleteSponsor(sponsorS1);
  await assertGone("sponsor logo nothing else references", sponsorMark);

  // ── 3. Deleting a club logo ───────────────────────────────────────────────
  const logoL2 = await createLogo({ name: "Gate Mark Two", imageId: sharedAB });
  made.logos.push(logoL2);
  ok((await deleteLogo(logoL2)) === "deleted", "an unreferenced logo deletes");
  await assertKept("logo mark an issue still shows", sharedAB);

  ok((await deleteLogo(logoL1)) === "deleted", "the first logo deletes");
  await assertGone("logo mark nothing else references", clubMark);

  // ── 4. A storage failure must not block the delete ────────────────────────
  // Simulated at the real seam: the PDF folder is made unreadable, so the
  // facade's list (and therefore the prefix sweep) genuinely throws. The
  // database work has already committed by then, and must stay committed.
  const issueC = await newIssue();
  const failImage = await fixtureImage(issueC);
  await setBlocks(issueC, [imageBlock(failImage)]);

  const pdfDir = path.join(UPLOADS, "pdfs", issueC);
  const strandedPdf = `pdfs/${issueC}/1-classic-nologo-abcdef-v8.pdf`;
  await mkdir(pdfDir, { recursive: true });
  await writeFile(path.join(UPLOADS, strandedPdf), "%PDF-1.4 stranded");
  made.dirs.push(pdfDir);
  await chmod(pdfDir, 0o000);

  let listThrew = false;
  try {
    await listKeys(`pdfs/${issueC}/`);
  } catch {
    listThrew = true;
  }
  ok(
    listThrew,
    "the simulated storage fault really does make the facade throw",
  );

  await deleteIssue(issueC); // must resolve, not reject
  ok(true, "deleteIssue resolved despite the storage failure");
  const [goneC] = await db
    .select({ id: issues.id })
    .from(issues)
    .where(eq(issues.id, issueC));
  ok(!goneC, "the issue row is still deleted after a failed sweep");
  await assertGone("orphan whose own key was reachable", failImage);

  await chmod(pdfDir, 0o700);
  ok(
    (await getObject(strandedPdf)) !== null,
    "the unreachable PDF is left in storage — leaked, which is the safe failure",
  );

  // ── 5. The prefix guard ───────────────────────────────────────────────────
  for (const bad of ["", "pdfs", "/pdfs/", "pdfs/../"]) {
    let threw = false;
    try {
      await deleteByPrefix(bad);
    } catch {
      threw = true;
    }
    ok(threw, `deleteByPrefix refuses ${JSON.stringify(bad)}`);
  }
} catch (err) {
  failed = true;
  console.error(err instanceof Error ? err.message : err);
} finally {
  // Remove only what this run created, by id. Sponsors and logos first (they
  // reference images), then issues, then the image rows and their bytes.
  for (const dir of made.dirs) {
    await chmod(dir, 0o700).catch(() => {});
    await rm(dir, { recursive: true, force: true });
  }
  if (made.sponsors.length) {
    await db.delete(sponsors).where(inArray(sponsors.id, made.sponsors));
  }
  if (made.logos.length) {
    await db.delete(logos).where(inArray(logos.id, made.logos));
  }
  if (made.issues.length) {
    await db.delete(issues).where(inArray(issues.id, made.issues));
  }
  if (made.images.length) {
    await db.delete(images).where(inArray(images.id, made.images));
  }
  for (const key of made.keys) {
    await rm(path.join(UPLOADS, key), { force: true });
  }
  // Both per-issue folders go whole, so a run leaves not even an empty one
  // behind. Named by the ids this run minted, so nothing else is in reach.
  for (const id of made.issues) {
    await rm(path.join(UPLOADS, "pdfs", id), { recursive: true, force: true });
    await rm(path.join(UPLOADS, "issues", id), {
      recursive: true,
      force: true,
    });
  }

  const after = await foreignCounts();
  const same =
    after.issues === before.issues &&
    after.images === before.images &&
    after.sponsors === before.sponsors &&
    after.logos === before.logos;
  if (!same) {
    failed = true;
    console.error(
      `FAIL: rows this run did not create changed — ` +
        `${JSON.stringify(before)} → ${JSON.stringify(after)}`,
    );
  } else {
    console.log(
      `ok — every pre-existing row is untouched (${after.issues} issues, ` +
        `${after.images} images, ${after.sponsors} sponsors, ${after.logos} logos)`,
    );
  }
}

console.log(failed ? "\nFAILED" : "\nall checks passed");
process.exit(failed ? 1 : 0);
