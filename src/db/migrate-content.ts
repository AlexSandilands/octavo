// One-off content migration: rewrite every issue's stored `content` to the
// current CONTENT_VERSION, converting legacy body-text strings to structured
// rich-text JSON (content v3 — see src/lib/rich-text-doc.ts). Backward-compatible
// on its own (the readers coerce legacy strings at render time), so this is an
// optional cleanup that makes the stored data uniformly v3 and drops the
// per-render conversion. Idempotent: a text block already holding a doc, and a
// cover-page tagline (kept as a plain string by design), are left untouched.
//
// Run: npm run db:migrate-content       (dry run — reports what would change)
//      npm run db:migrate-content -- --write   (apply)
import { CONTENT_VERSION, issueContentSchema } from "../lib/blocks";
import { stringToDoc } from "../lib/rich-text-doc";

try {
  process.loadEnvFile?.(".env.local");
} catch {
  // env may already be set in the shell — fine.
}

// Convert a stored content document in place: bump the version, and turn every
// non-cover body-text string into a doc. Cover pages keep their plain strings.
// Returns the new content and how many text blocks were converted.
function upgrade(content: {
  version?: number;
  pages: { cover?: boolean; blocks: { type: string; text?: unknown }[] }[];
}): { content: unknown; converted: number } {
  let converted = 0;
  const pages = content.pages.map((page) => ({
    ...page,
    blocks: page.blocks.map((block) => {
      if (block.type !== "text" || page.cover) return block;
      if (typeof block.text !== "string") return block; // already a doc
      converted++;
      return { ...block, text: stringToDoc(block.text) };
    }),
  }));
  return { content: { ...content, version: CONTENT_VERSION, pages }, converted };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const write = process.argv.includes("--write");

  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { default: postgres } = await import("postgres");
  const { eq } = await import("drizzle-orm");
  const { issues } = await import("./schema");
  const client = postgres(url, { max: 1 });
  const db = drizzle({ client });

  const rows = await db
    .select({ id: issues.id, number: issues.number, content: issues.content })
    .from(issues);

  let changedIssues = 0;
  let convertedBlocks = 0;
  for (const row of rows) {
    const source = row.content as Parameters<typeof upgrade>[0];
    const { content, converted } = upgrade(source);
    // Nothing to do once a document is already at the current version with no
    // legacy body-text strings left (idempotent — a byte compare would be noisy
    // because Postgres reorders JSONB keys on read).
    if (converted === 0 && source.version === CONTENT_VERSION) continue;
    // Validate the result against the live schema before writing — the same
    // guard the editor's save path runs, so a bad conversion can't persist.
    const parsed = issueContentSchema.safeParse(content);
    if (!parsed.success) {
      console.error(
        `Issue #${row.number} (${row.id}) failed validation:`,
        parsed.error.issues.slice(0, 3),
      );
      throw new Error("Aborting: a converted document did not validate.");
    }
    changedIssues++;
    convertedBlocks += converted;
    if (write) {
      await db
        .update(issues)
        .set({ content: parsed.data })
        .where(eq(issues.id, row.id));
    }
  }

  console.log(
    `${write ? "Migrated" : "Would migrate"} ${changedIssues} issue(s); ` +
      `${convertedBlocks} text block(s) converted to rich-text JSON.` +
      (write ? "" : "  (dry run — pass --write to apply)"),
  );
  await client.end();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
