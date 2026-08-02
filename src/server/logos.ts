import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { images, logos } from "@/db/schema";
import { keyToUrl } from "@/lib/storage";
import type { LogoListItem } from "@/lib/logos";

// Server-only data access for the logo library. The admin page goes through
// here — never Drizzle directly. Every read joins the mark so callers get a
// ready-to-render URL, mirroring server/sponsors.ts.

// Explicit column list — no spreads — so a schema change can't silently widen
// what we read. The join is inner: `logos.imageId` is notNull and cascades, so
// a logo without its mark cannot exist.
const logoSelection = {
  id: logos.id,
  name: logos.name,
  imageId: logos.imageId,
  imageKey: images.key,
  imageWidth: images.width,
  imageHeight: images.height,
};

// Every logo, newest first, with its mark resolved to a public URL.
export async function listLogos(): Promise<LogoListItem[]> {
  const rows = await db
    .select(logoSelection)
    .from(logos)
    .innerJoin(images, eq(logos.imageId, images.id))
    .orderBy(desc(logos.createdAt));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    imageId: row.imageId,
    image: {
      url: keyToUrl(row.imageKey),
      width: row.imageWidth,
      height: row.imageHeight,
    },
  }));
}

// Explicit column list — never spread caller input into the VALUES clause.
export async function createLogo(input: {
  name: string;
  imageId: string;
}): Promise<string> {
  const [row] = await db
    .insert(logos)
    .values({ name: input.name, imageId: input.imageId })
    .returning({ id: logos.id });
  if (!row) throw new Error("Failed to create logo");
  return row.id;
}

// Renaming is the only edit: the mark itself is the record's identity, so
// swapping it means adding a new logo and deleting the old one.
export async function renameLogo(id: string, name: string): Promise<void> {
  await db.update(logos).set({ name }).where(eq(logos.id, id));
}

// Where a logo can be referenced from. Deleting one that is in use would leave
// a dangling id behind, so each referencing site registers a counter here and
// deleteLogo refuses while any of them reports a hit. Deliberately empty today:
// nothing references a logo until issue #97 adds `issues.logoId` (the page
// footer watermark), which becomes the first entry — the refusal path below is
// already wired through the action and the admin UI.
const REFERENCE_COUNTERS: ((logoId: string) => Promise<number>)[] = [];

export async function countLogoReferences(logoId: string): Promise<number> {
  const counts = await Promise.all(REFERENCE_COUNTERS.map((c) => c(logoId)));
  return counts.reduce((total, n) => total + n, 0);
}

// Refuses while anything still points at the logo — unlike a sponsor (whose
// slot is meant to disappear when the sponsor goes), a referenced logo is a
// layout element, and silently emptying it would break pages the admin can't
// see from here. The underlying image row is left alone: nothing in the app
// deletes images, and an orphaned one costs a key in storage, not a broken page.
export async function deleteLogo(id: string): Promise<"deleted" | "in-use"> {
  if ((await countLogoReferences(id)) > 0) return "in-use";
  await db.delete(logos).where(eq(logos.id, id));
  return "deleted";
}
