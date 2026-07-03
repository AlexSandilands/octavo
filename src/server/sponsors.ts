import "server-only";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { images, sponsors } from "@/db/schema";
import { keyToUrl } from "@/lib/storage";
import type { ResolvedImage } from "@/lib/images";
import {
  activeUntilToDateString,
  collectSponsorIds,
  isSponsorExpired,
  type SponsorListItem,
  type SponsorMap,
} from "@/lib/sponsors";
import type { IssueContent } from "@/lib/blocks";

// Server-only data access for managed sponsors. Editor, reader and the admin
// sponsors page go through here — never Drizzle directly. Every read joins the
// logo image so callers get a ready-to-render URL, mirroring server/images.ts.

// The columns every query selects, joined to the logo image. Explicit list — no
// spreads — so a schema change can't silently widen what we read.
const sponsorSelection = {
  id: sponsors.id,
  name: sponsors.name,
  href: sponsors.href,
  logoId: sponsors.logoId,
  activeUntil: sponsors.activeUntil,
  createdAt: sponsors.createdAt,
  logoKey: images.key,
  logoWidth: images.width,
  logoHeight: images.height,
};

type SponsorRow = {
  id: string;
  name: string;
  href: string | null;
  logoId: string | null;
  activeUntil: Date | null;
  createdAt: Date;
  logoKey: string | null;
  logoWidth: number | null;
  logoHeight: number | null;
};

function rowLogo(row: SponsorRow): ResolvedImage | null {
  if (!row.logoKey) return null;
  return {
    url: keyToUrl(row.logoKey),
    width: row.logoWidth,
    height: row.logoHeight,
  };
}

// The admin list + editor picker shape: every sponsor, newest first, with logo
// resolved and expiry pre-computed on the server.
export async function listSponsors(): Promise<SponsorListItem[]> {
  const rows = await db
    .select(sponsorSelection)
    .from(sponsors)
    .leftJoin(images, eq(sponsors.logoId, images.id))
    .orderBy(desc(sponsors.createdAt));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    href: row.href,
    logoId: row.logoId,
    logo: rowLogo(row),
    activeUntil: activeUntilToDateString(row.activeUntil),
    expired: isSponsorExpired(row.activeUntil),
  }));
}

// sponsorId -> { name, href, logo } for every sponsor a document references.
// Deleted sponsors simply don't appear, so the renderers hide their slots.
export async function resolveIssueSponsors(
  content: Pick<IssueContent, "pages">,
): Promise<SponsorMap> {
  const ids = collectSponsorIds(content);
  if (ids.length === 0) return {};
  const rows = await db
    .select(sponsorSelection)
    .from(sponsors)
    .leftJoin(images, eq(sponsors.logoId, images.id))
    .where(inArray(sponsors.id, ids));
  const map: SponsorMap = {};
  for (const row of rows) {
    map[row.id] = { name: row.name, href: row.href, logo: rowLogo(row) };
  }
  return map;
}

export type SponsorInput = {
  name: string;
  href: string | null;
  logoId: string | null;
  activeUntil: Date | null;
};

// Explicit column list — never spread caller input into the VALUES/SET clause.
export async function createSponsor(input: SponsorInput): Promise<string> {
  const [row] = await db
    .insert(sponsors)
    .values({
      name: input.name,
      href: input.href,
      logoId: input.logoId,
      activeUntil: input.activeUntil,
    })
    .returning({ id: sponsors.id });
  if (!row) throw new Error("Failed to create sponsor");
  return row.id;
}

export async function updateSponsor(
  id: string,
  input: SponsorInput,
): Promise<void> {
  await db
    .update(sponsors)
    .set({
      name: input.name,
      href: input.href,
      logoId: input.logoId,
      activeUntil: input.activeUntil,
    })
    .where(eq(sponsors.id, id));
}

// Deleting a sponsor leaves the sponsorId dangling in any issue that placed it;
// that is intentional — the reader resolves a missing sponsor to nothing and
// hides the slot (a removed sponsor must not keep advertising). See BlockView.
export async function deleteSponsor(id: string): Promise<void> {
  await db.delete(sponsors).where(eq(sponsors.id, id));
}
