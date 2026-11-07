// Draft version history (aboard #51): the versions the save path keeps, their
// pruning, restore, and the images and logos they hold on to.
//
//   npx tsx --tsconfig scripts/tsconfig.json scripts/dev-version-history-gate.mts [base-url] [shots-dir]
//
// Without a URL it drives the server modules in process. With one it also goes
// through a running dev server (scripts/version-history-routes.mts): the
// editor's save, the History routes and their refusals, the preview page, and
// the History tab and restore in Chromium, screenshotted into shots-dir.
//
// SAFETY: it writes to the local database and the local-disk store only. Every
// row it touches is one it made, tracked by id and removed in the finally.
import { eq, sql } from "drizzle-orm";
import { db } from "../src/db";
import { images, logos, sessions, users } from "../src/db/schema";
import { issueVersions } from "../src/db/schema-versions";
import {
  CONTENT_VERSION,
  makeBlock,
  makePage,
  type Block,
  type IssueContent,
  type Page,
} from "../src/lib/blocks";
import { makeCoverElement } from "../src/lib/cover-elements";
import { createId } from "../src/lib/id";
import { KEEP_VERSIONS } from "../src/lib/issue-versions";
import { getObject, putObject, usingLocalStorage } from "../src/lib/storage";
import { createImageRecord } from "../src/server/images";
import {
  getIssue,
  createIssue,
  deleteIssue,
  updateIssueContent,
} from "../src/server/issues";
import {
  getVersion,
  listVersions,
  restoreVersion,
} from "../src/server/issue-versions";
import { createLogo, deleteLogo } from "../src/server/logos";
import { routeChecks } from "./version-history-routes.mts";

process.loadEnvFile?.(".env.local");

const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
};

if (!usingLocalStorage()) {
  throw new Error("Refusing to run against configured R2 — unset R2_*.");
}

const BASE = process.argv[2]?.replace(/\/$/, "");
const RESERVE = { footerMarkSize: 27, footerTextSize: 10 } as const;

const made = {
  issues: [] as string[],
  images: [] as string[],
  logos: [] as string[],
  users: [] as string[],
};

async function newIssue(): Promise<string> {
  const issue = await createIssue(RESERVE);
  made.issues.push(issue.id);
  return issue.id;
}

async function newImage(issueId: string | null): Promise<{
  id: string;
  key: string;
}> {
  const key = `issues/${issueId ?? "none"}/${createId()}.webp`;
  await putObject(key, Buffer.from(`bytes ${key}`), "image/webp");
  const row = await createImageRecord({ key, width: 8, height: 8, issueId });
  made.images.push(row.id);
  return { id: row.id, key };
}

const imageBlock = (imageId: string): Block => ({
  id: createId(),
  type: "image",
  imageId,
  caption: "",
  align: "full",
  width: 100,
});

function doc(pages: Page[]): IssueContent {
  return { version: CONTENT_VERSION, pages };
}
const cover = (): Page => ({ ...makePage("cover-classic"), cover: true });
const page = (blocks: Block[]): Page => ({ id: createId(), blocks });
const textPages = (n: number) =>
  Array.from({ length: n }, () => page([makeBlock("text")]));

// Pretend the last save was long ago, so the next one starts a new sitting.
async function backdate(id: string, minutes = 120) {
  await db.execute(
    sql`update issues set updated_at = now() - make_interval(mins => ${minutes}),
        created_at = now() - make_interval(mins => ${minutes}) where id = ${id}`,
  );
}

async function revisionOf(id: string): Promise<number> {
  return (await getIssue(id))!.revision;
}

async function save(id: string, content: IssueContent) {
  const result = await updateIssueContent(id, content, await revisionOf(id));
  if (!result.ok) throw new Error(`save failed: ${result.reason}`);
  return result.revision;
}

const imageRow = async (id: string) =>
  (await db.select({ id: images.id }).from(images).where(eq(images.id, id)))
    .length > 0;

async function moduleChecks() {
  // ── Taking versions ───────────────────────────────────────────────────────
  const a = await newIssue();
  await save(a, doc([cover(), ...textPages(4)]));
  ok((await listVersions(a)).length === 0, "a new draft's saves keep nothing");

  await backdate(a);
  await save(a, doc([cover(), ...textPages(4), page([makeBlock("heading")])]));
  let versions = await listVersions(a);
  ok(
    versions.length === 1 && versions[0]!.reason === "session",
    "a save after a long pause keeps a session version",
  );
  ok(versions[0]!.pageCount === 5, "the version records the old page count");

  await save(a, doc([cover(), ...textPages(4)]));
  ok(
    (await listVersions(a)).length === 1,
    "a quick follow-on save keeps nothing",
  );

  await save(a, doc([cover(), ...textPages(1)]));
  versions = await listVersions(a);
  ok(
    versions.length === 2 && versions[0]!.reason === "large-removal",
    "dropping three pages keeps a large-removal version",
  );

  // ── Prune ─────────────────────────────────────────────────────────────────
  for (let i = 0; i < KEEP_VERSIONS + 2; i += 1) {
    await backdate(a, 40);
    await save(a, doc([cover(), ...textPages(1 + (i % 2))]));
  }
  versions = await listVersions(a);
  ok(
    versions.length === KEEP_VERSIONS,
    `pruned to the newest ${KEEP_VERSIONS}`,
  );
  ok(
    versions.every((v, i) => i === 0 || versions[i - 1]!.revision > v.revision),
    "listed newest first",
  );

  // ── Restore ───────────────────────────────────────────────────────────────
  const target = versions[3]!;
  const kept = await getVersion(a, target.id);
  ok(
    kept && kept.content.pages.length === target.pageCount,
    "getVersion reads the pages",
  );
  const rev = await revisionOf(a);
  const stale = await restoreVersion(a, target.id, rev - 1);
  ok(!stale.ok && stale.reason === "conflict", "a stale restore is a conflict");
  const missing = await restoreVersion(a, createId(), rev);
  ok(
    !missing.ok && missing.reason === "missing",
    "an unknown version is missing",
  );
  const restored = await restoreVersion(a, target.id, rev);
  ok(
    restored.ok && restored.revision === rev + 1,
    "restore bumps the revision",
  );
  ok(
    (await getIssue(a))!.content.pages.length === target.pageCount,
    "restore puts the version's pages back",
  );
  versions = await listVersions(a);
  ok(
    versions[0]!.reason === "before-restore" && versions[0]!.revision === rev,
    "the replaced pages are kept as before-restore",
  );
  ok(versions.length === KEEP_VERSIONS, "restore prunes too");

  // Churn: identical pages are never kept twice.
  const again = await restoreVersion(a, target.id, await revisionOf(a));
  const afterAgain = await listVersions(a);
  ok(
    again.ok &&
      afterAgain.length === KEEP_VERSIONS &&
      afterAgain[0]!.id === target.id &&
      afterAgain.filter((v) => v.id === target.id).length === 1,
    "restoring the same version again copies nothing; that version moves up instead",
  );
  const c0 = await newIssue();
  const fullDoc = doc([cover(), ...textPages(5)]);
  await save(c0, fullDoc);
  await save(c0, doc([cover(), ...textPages(1)])); // a large removal
  await save(c0, fullDoc); // undo
  await save(c0, doc([cover(), ...textPages(1)])); // redo
  ok(
    (await listVersions(c0)).length === 1,
    "an undo and redo of a large deletion keeps one version, not two",
  );
  // A later sitting: the removal kept above is outside the streak window.
  await db.execute(
    sql`update issue_versions set created_at = now() - interval '20 minutes' where issue_id = ${c0}`,
  );
  await save(c0, doc([cover(), ...textPages(5)]));
  await save(c0, doc([cover(), ...textPages(4)]));
  await save(c0, doc([cover(), ...textPages(3)]));
  const stepwise = await listVersions(c0);
  ok(
    stepwise.length === 2 && stepwise[0]!.pageCount === 5,
    "pages deleted one save at a time add up to a large removal",
  );
  for (let pages = 2; pages >= 0; pages -= 1) {
    await save(c0, doc([cover(), ...textPages(pages)]));
  }
  ok(
    (await listVersions(c0)).length === 2,
    "a streak of single-page deletes keeps one version, not one per page",
  );

  // ── Images only a version shows ───────────────────────────────────────────
  const b = await newIssue();
  const c = await newIssue();
  const photo = await newImage(c); // uploaded under C, so C's delete weighs it
  await save(b, doc([cover(), page([imageBlock(photo.id)]), ...textPages(3)]));
  await backdate(b);
  await save(b, doc([cover(), ...textPages(1)])); // photo only in B's version now
  ok((await listVersions(b)).length === 1, "B kept the pages the photo was on");
  await deleteIssue(c);
  ok(
    await imageRow(photo.id),
    "a photo only B's version shows survives deleting C",
  );
  ok((await getObject(photo.key)) !== null, "…and so do its bytes");
  await deleteIssue(b);
  ok(
    !(await imageRow(photo.id)),
    "deleting B takes the photo its version held",
  );
  ok((await getObject(photo.key)) === null, "…and its bytes");

  // ── A logo deleted since the version ──────────────────────────────────────
  const d = await newIssue();
  const mark = await newImage(null);
  const logoId = await createLogo({
    name: `gate51-${createId()}`,
    imageId: mark.id,
  });
  made.logos.push(logoId);
  const logoCover: Page = {
    ...cover(),
    coverElements: [
      { ...makeCoverElement("logo"), logoId, imageId: mark.id } as never,
    ],
  };
  await save(d, doc([logoCover, ...textPages(3)]));
  await backdate(d);
  await save(d, doc([cover(), ...textPages(3)]));
  ok(
    (await deleteLogo(logoId)) === "deleted",
    "a version does not stop the logo being deleted",
  );
  ok(await imageRow(mark.id), "the version keeps the logo's artwork");
  const [version] = await listVersions(d);
  const back = await restoreVersion(d, version!.id, await revisionOf(d));
  ok(back.ok && back.unlinkedLogos === 1, "restore reports one unlinked logo");
  const element = (await getIssue(d))!.content.pages[0]!.coverElements?.[0];
  ok(
    element?.type === "logo" && !element.logoId && element.imageId === mark.id,
    "the restored cover keeps the artwork without the dangling logo id",
  );
}

async function cleanup() {
  for (const id of made.issues) {
    if (await getIssue(id)) await deleteIssue(id);
  }
  for (const id of made.logos) {
    await db.delete(logos).where(eq(logos.id, id));
  }
  for (const id of made.images) {
    await db.delete(images).where(eq(images.id, id));
  }
  for (const id of made.users) {
    await db.delete(sessions).where(eq(sessions.userId, id));
    await db.delete(users).where(eq(users.id, id));
  }
}

let failed = false;
try {
  await moduleChecks();
  if (BASE) {
    await routeChecks({
      base: BASE,
      shots: process.argv[3] ?? null,
      ok,
      newIssue,
      backdate,
      made,
    });
  }
} catch (err) {
  failed = true;
  console.error(err);
} finally {
  await cleanup();
  const left = await db
    .select({ n: sql<number>`count(*)` })
    .from(issueVersions)
    .where(
      sql`${issueVersions.issueId} in ${made.issues.length ? made.issues : [""]}`,
    );
  console.log(`cleanup: ${Number(left[0]?.n ?? 0)} gate versions left`);
}
console.log(
  failed ? "\nversion-history gate FAILED" : "\nversion-history gate passed",
);
process.exit(failed ? 1 : 0);
