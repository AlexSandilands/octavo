import "server-only";
import { db } from "@/db";
import { issues, logos, sponsors } from "@/db/schema";
import { normaliseLibraryName } from "@/lib/issue-transfer/manifest";
import type { DestinationLibrary } from "@/lib/issue-transfer/resolve";

// The destination library an import matches a bundle against. Read twice: once
// to decide what to upload, once inside the commit transaction under its lock.

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function readLibrary(
  executor: Executor = db,
): Promise<DestinationLibrary> {
  const sponsorRows = await executor
    .select({ id: sponsors.id, name: sponsors.name })
    .from(sponsors);
  const logoRows = await executor
    .select({ id: logos.id, name: logos.name, imageId: logos.imageId })
    .from(logos);
  return { sponsors: sponsorRows, logos: logoRows };
}

/** Which of these titles the archive already holds. Compared in Node rather
 *  than SQL so the one definition of "the same name" governs here too. */
export async function findExistingTitles(
  titles: string[],
): Promise<Set<string>> {
  const wanted = new Set(titles.map(normaliseLibraryName));
  if (wanted.size === 0) return new Set();
  const rows = await db.select({ title: issues.title }).from(issues);
  const found = new Set<string>();
  for (const row of rows) {
    const key = normaliseLibraryName(row.title);
    if (wanted.has(key)) found.add(key);
  }
  return found;
}
