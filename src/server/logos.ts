import "server-only";
import { count, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { images, issues, logos } from "@/db/schema";
import { keyToUrl } from "@/lib/storage";
import type { ResolvedImage } from "@/lib/images";
import type { LogoListItem } from "@/lib/logos";
import { sweepOrphanedObjects, takeOrphanedImages } from "./asset-cleanup";

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

// One logo's mark, resolved for rendering — what the page footer needs and
// nothing more. Null for a null id (the common case: most issues have no logo)
// and for an id that no longer names a logo, so a stale reference degrades to
// the text-only footer instead of a broken image.
export async function getLogoImage(
  logoId: string | null,
): Promise<ResolvedImage | null> {
  if (!logoId) return null;
  const [row] = await db
    .select({
      key: images.key,
      width: images.width,
      height: images.height,
    })
    .from(logos)
    .innerJoin(images, eq(logos.imageId, images.id))
    .where(eq(logos.id, logoId))
    .limit(1);
  if (!row) return null;
  return { url: keyToUrl(row.key), width: row.width, height: row.height };
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
// deleteLogo refuses while any of them reports a hit. Add an entry per new
// referencing site — nothing else needs to change for the refusal to hold.
const REFERENCE_COUNTERS: ((logoId: string) => Promise<number>)[] = [
  // issues.logoId — the running page footer's mark (issue #97). Counts drafts
  // as well as published issues: an admin who picked the logo for a draft would
  // otherwise lose it silently before the issue ever shipped.
  async (logoId) => {
    const [row] = await db
      .select({ n: count() })
      .from(issues)
      .where(eq(issues.logoId, logoId));
    return row?.n ?? 0;
  },
];

export async function countLogoReferences(logoId: string): Promise<number> {
  const counts = await Promise.all(REFERENCE_COUNTERS.map((c) => c(logoId)));
  return counts.reduce((total, n) => total + n, 0);
}

// Refuses while anything still points at the logo — unlike a sponsor (whose
// slot is meant to disappear when the sponsor goes), a referenced logo is a
// layout element, and silently emptying it would break pages the admin can't
// see from here.
//
// The mark itself goes with it when nothing else shows it (issue #84). The same
// guard as everywhere else decides that: an uploaded mark can also have been
// placed on a page or given to a sponsor, and the reference scan — run inside
// this transaction, after the logo row is gone — is what knows.
//
// The count above and the delete below are still two steps, as they always
// were: an issue that adopts this logo in between loses its mark. Sweeping the
// image adds nothing to that race — the footer is already text-only once the
// logo row goes, whether or not the bytes survive it.
export async function deleteLogo(id: string): Promise<"deleted" | "in-use"> {
  if ((await countLogoReferences(id)) > 0) return "in-use";

  const orphanedKeys = await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ imageId: logos.imageId })
      .from(logos)
      .where(eq(logos.id, id))
      .limit(1);
    if (!row) return [];

    await tx.delete(logos).where(eq(logos.id, id));
    return takeOrphanedImages(tx, [row.imageId]);
  });

  // Committed — best-effort from here (see server/asset-cleanup.ts).
  await sweepOrphanedObjects({ keys: orphanedKeys, context: { logoId: id } });
  return "deleted";
}
