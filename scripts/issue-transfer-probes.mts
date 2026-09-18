// Small readers the issue-transfer gate asserts against (issue #293).
import { eq } from "drizzle-orm";
import { db } from "../src/db/index.ts";
import { issues } from "../src/db/schema.ts";
import {
  ensureCoverFirst,
  issueContentSchema,
  type Block,
  type IssueContent,
} from "../src/lib/blocks.ts";
import { readZipEntries } from "./issue-transfer-fixtures.mts";

export async function issueRow(id: string) {
  const [row] = await db
    .select()
    .from(issues)
    .where(eq(issues.id, id))
    .limit(1);
  if (!row) throw new Error(`no issue ${id}`);
  return row;
}

export async function issueIdsIn(archive: Buffer): Promise<string[]> {
  const found = await readZipEntries(archive).catch(() => []);
  const manifest = found.find((e) => e.name === "manifest.json");
  if (!manifest) return [];
  try {
    const parsed = JSON.parse(manifest.bytes.toString("utf8")) as {
      issues?: { id: string }[];
    };
    return (parsed.issues ?? []).map((issue) => issue.id);
  } catch {
    return [];
  }
}

export function coverLogoOf(content: IssueContent) {
  const element = content.pages[0]?.coverElements?.[0];
  return element?.type === "logo" ? element : null;
}

export function imageBlocks(content: IssueContent) {
  return content.pages
    .flatMap((page) => page.blocks)
    .filter(
      (block): block is Extract<Block, { type: "image" }> =>
        block.type === "image",
    );
}

export function sponsorBlockOf(content: IssueContent) {
  return content.pages
    .flatMap((page) => page.blocks)
    .find((block) => block.type === "sponsor");
}

/** The document with every image id emptied, so two can be compared on
 *  everything else — the parse also applies the same schema defaults to both. */
export function blankImages(content: unknown): unknown {
  const parsed = issueContentSchema.parse(content);
  const normalised = { ...parsed, pages: ensureCoverFirst(parsed.pages) };
  return JSON.parse(
    JSON.stringify(normalised, (key, value: unknown) =>
      key === "imageId" || key === "posterImageId" ? "" : value,
    ),
  );
}
