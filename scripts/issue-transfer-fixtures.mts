// Fixtures and archive plumbing for scripts/dev-issue-transfer-gate.mts
// (issue #293). Kept apart so the gate itself reads as the list of things it
// proves. Everything here creates rows and objects the gate removes again; it
// never matches on names or patterns and never touches rows it did not make.
import { eq, inArray } from "drizzle-orm";
import sharp from "sharp";
import { zip } from "../src/server/issue-transfer/zip.ts";
import { db } from "../src/db/index.ts";
import {
  images,
  issueImports,
  issues,
  logos,
  sessions,
  sponsors,
  users,
} from "../src/db/schema.ts";
import { CONTENT_VERSION, type IssueContent } from "../src/lib/blocks.ts";
import { createId } from "../src/lib/id.ts";
import { deleteObject, putObject } from "../src/lib/storage.ts";

export type Made = {
  issues: string[];
  images: string[];
  sponsors: string[];
  logos: string[];
  users: string[];
  keys: string[];
  operations: string[];
};

export const made: Made = {
  issues: [],
  images: [],
  sponsors: [],
  logos: [],
  users: [],
  keys: [],
  operations: [],
};

/** A real WebP, so sharp's decode check has something to decode. */
export async function webp(width: number, height: number, r: number) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r, g: 120, b: 200 },
    },
  })
    .webp({ quality: 80 })
    .toBuffer();
}

export async function makeImage(
  width: number,
  height: number,
  tint: number,
): Promise<{ id: string; key: string; bytes: Buffer }> {
  const id = createId();
  const key = `images/${id}.webp`;
  const bytes = await webp(width, height, tint);
  await putObject(key, bytes, "image/webp");
  await db.insert(images).values({ id, key, width, height, issueId: null });
  made.images.push(id);
  made.keys.push(key);
  return { id, key, bytes };
}

export async function makeLogo(name: string, imageId: string) {
  const id = createId();
  await db.insert(logos).values({ id, name, imageId });
  made.logos.push(id);
  return id;
}

export async function makeSponsor(name: string, href: string | null) {
  const id = createId();
  await db.insert(sponsors).values({ id, name, href });
  made.sponsors.push(id);
  return id;
}

export type IssueFixture = {
  title: string;
  logoId: string | null;
  content: IssueContent;
};

export async function makeIssue(fixture: IssueFixture): Promise<string> {
  const id = createId();
  await db.insert(issues).values({
    id,
    title: fixture.title,
    theme: "classic",
    status: "draft",
    content: fixture.content,
    footerMarkSize: 27,
    footerTextSize: 10,
    logoId: fixture.logoId,
  });
  made.issues.push(id);
  return id;
}

/** A document using every image-bearing site plus a managed sponsor — and,
 *  deliberately, an ordinary photo block showing the logo's own artwork, so the
 *  per-use resolution has something to tell apart. */
export function fixtureContent(refs: {
  block: string;
  slide: string;
  poster: string;
  coverLogoImage: string;
  logoId: string;
  sponsorId: string;
}): IssueContent {
  return {
    version: CONTENT_VERSION,
    pages: [
      {
        id: createId(),
        cover: true,
        coverElements: [
          {
            id: createId(),
            type: "logo",
            placement: {
              column: "right",
              row: "bottom",
              width: "medium",
              align: "right",
              offset: 0,
            },
            logoId: refs.logoId,
            imageId: refs.coverLogoImage,
            alt: "Club crest",
            size: 100,
          },
        ],
        blocks: [
          { id: createId(), type: "heading", kicker: "Spring", title: "Cover" },
        ],
      },
      {
        id: createId(),
        blocks: [
          { id: createId(), type: "text", text: "Opening paragraph." },
          {
            id: createId(),
            type: "image",
            imageId: refs.block,
            caption: "A photo",
            align: "full",
            width: 100,
          },
          {
            id: createId(),
            type: "montage",
            items: [{ imageId: refs.slide, alt: "Slide" }],
            caption: "",
            interval: 5,
            align: "full",
            width: 100,
          },
          {
            id: createId(),
            type: "video",
            provider: "youtube",
            videoId: "dQw4w9WgXcQ",
            posterImageId: refs.poster,
            caption: "",
            align: "full",
            width: 100,
          },
          {
            id: createId(),
            type: "image",
            imageId: refs.coverLogoImage,
            caption: "The crest, as a photo",
            align: "full",
            width: 100,
          },
          {
            id: createId(),
            type: "sponsor",
            sponsorId: refs.sponsorId,
            name: "",
          },
        ],
      },
    ],
  };
}

/** A signed-in admin: a users row plus a sessions row whose token is the
 *  cookie. AUTH_URL names another port, so a magic link would sign in on the
 *  wrong server (docs/workflow.md). */
export async function scratchAdmin(): Promise<{ id: string; cookie: string }> {
  const id = createId();
  const token = createId();
  await db.insert(users).values({
    id,
    email: `scratch-293-${id.slice(0, 8)}@example.invalid`,
    isAdmin: true,
  });
  await db.insert(sessions).values({
    sessionToken: token,
    userId: id,
    expires: new Date(Date.now() + 60 * 60 * 1000),
  });
  made.users.push(id);
  return { id, cookie: `authjs.session-token=${token}` };
}

export async function scratchMember(): Promise<{ id: string; cookie: string }> {
  const admin = await scratchAdmin();
  await db.update(users).set({ isAdmin: false }).where(eq(users.id, admin.id));
  return admin;
}

// ── archives ────────────────────────────────────────────────────────────────

export type ZipEntry = {
  name: string;
  bytes: Buffer;
  store: boolean;
  /** The size written into the headers, when it should lie about the content. */
  declaredName?: string;
};

export async function readZipEntries(
  archive: Buffer,
): Promise<{ name: string; bytes: Buffer; method: number }[]> {
  const reader = new zip.ZipReader(new zip.Uint8ArrayReader(archive));
  const out: { name: string; bytes: Buffer; method: number }[] = [];
  for (const entry of await reader.getEntries()) {
    if (entry.directory) continue;
    out.push({
      name: entry.filename,
      bytes: Buffer.from(await entry.getData(new zip.Uint8ArrayWriter())),
      method: entry.compressionMethod ?? 0,
    });
  }
  await reader.close();
  return out;
}

export async function writeZip(entries: ZipEntry[]): Promise<Buffer> {
  const writer = new zip.ZipWriter(new zip.Uint8ArrayWriter());
  for (const entry of entries) {
    await writer.add(entry.name, new zip.Uint8ArrayReader(entry.bytes), {
      level: entry.store ? 0 : undefined,
    });
  }
  return Buffer.from(await writer.close());
}

/** Rebuild an archive with the manifest replaced and entries added or removed. */
export async function rebuild(
  archive: Buffer,
  edit: (manifest: Record<string, unknown>) => Record<string, unknown> | void,
  extra: ZipEntry[] = [],
  drop: string[] = [],
): Promise<Buffer> {
  const entries = await readZipEntries(archive);
  const manifestEntry = entries.find((e) => e.name === "manifest.json")!;
  const manifest = JSON.parse(manifestEntry.bytes.toString("utf8"));
  const edited = edit(manifest) ?? manifest;
  const rebuilt: ZipEntry[] = [
    {
      name: "manifest.json",
      bytes: Buffer.from(JSON.stringify(edited), "utf8"),
      store: false,
    },
    ...entries
      .filter((e) => e.name !== "manifest.json" && !drop.includes(e.name))
      .map((e) => ({
        name: e.name,
        bytes: e.bytes,
        store: e.name.startsWith("images/"),
      })),
    ...extra,
  ];
  return writeZip(rebuilt);
}

// Rows this run did not create, recorded before it starts. Everything that
// appears afterwards — including whatever an import wrote — is adopted, so the
// cleanup removes exactly what the run is responsible for and the final count
// proves nothing else moved.
type Baseline = Record<"issues" | "images" | "sponsors" | "logos", Set<string>>;
let baseline: Baseline | null = null;

async function idsNow(): Promise<Baseline> {
  const [i, m, s, l] = await Promise.all([
    db.select({ id: issues.id }).from(issues),
    db.select({ id: images.id }).from(images),
    db.select({ id: sponsors.id }).from(sponsors),
    db.select({ id: logos.id }).from(logos),
  ]);
  return {
    issues: new Set(i.map((r) => r.id)),
    images: new Set(m.map((r) => r.id)),
    sponsors: new Set(s.map((r) => r.id)),
    logos: new Set(l.map((r) => r.id)),
  };
}

export async function takeBaseline(): Promise<void> {
  baseline = await idsNow();
}

/** Adopt every row that has appeared since the baseline, so an import's own
 *  issues, images and library entries are cleaned up with the fixtures. */
export async function adoptNewRows(): Promise<void> {
  if (!baseline) throw new Error("takeBaseline() first");
  const now = await idsNow();
  const add = (kind: keyof Baseline) => {
    for (const id of now[kind]) {
      if (!baseline![kind].has(id) && !made[kind].includes(id)) {
        made[kind].push(id);
      }
    }
  };
  add("issues");
  add("images");
  add("sponsors");
  add("logos");
  const keyed = made.images.length
    ? await db
        .select({ key: images.key })
        .from(images)
        .where(inArray(images.id, made.images))
    : [];
  for (const row of keyed) {
    if (!made.keys.includes(row.key)) made.keys.push(row.key);
  }
}

/** How many rows exist that this run did not create — asserted unchanged. */
export async function foreignCounts(): Promise<Record<string, number>> {
  const now = await idsNow();
  const count = (kind: keyof Baseline) =>
    [...now[kind]].filter((id) => !made[kind].includes(id)).length;
  return {
    issues: count("issues"),
    images: count("images"),
    sponsors: count("sponsors"),
    logos: count("logos"),
  };
}

export async function cleanup(): Promise<void> {
  await adoptNewRows().catch(() => {});
  if (made.operations.length) {
    await db
      .delete(issueImports)
      .where(inArray(issueImports.id, made.operations));
  }
  if (made.issues.length) {
    await db.delete(issues).where(inArray(issues.id, made.issues));
  }
  if (made.logos.length) {
    await db.delete(logos).where(inArray(logos.id, made.logos));
  }
  if (made.sponsors.length) {
    await db.delete(sponsors).where(inArray(sponsors.id, made.sponsors));
  }
  if (made.images.length) {
    await db.delete(images).where(inArray(images.id, made.images));
  }
  if (made.users.length) {
    await db.delete(users).where(inArray(users.id, made.users));
  }
  for (const key of made.keys) await deleteObject(key).catch(() => {});
}
