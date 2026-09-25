// Dev-only: each of the assistant's four presets (#310) run once on a seed page,
// against whatever provider the dev server has — the fake for a dry run, a real
// model for the PR's evidence:
//   AI_PROVIDER=anthropic AI_MONTHLY_BUDGET_USD=5 NEXT_PUBLIC_AI_ASSISTANT=1 PORT=3310 npm run dev
//   npx tsx --tsconfig scripts/tsconfig.json scripts/dev-assistant-presets.mts http://localhost:3310 <shots-dir>
// The pages are the spike's cases (scripts/spike/assistant/cases): Tidy on the
// notices lump (01), Make bullets on the notices page (02), Rewrite for clarity
// on one selected paragraph (11), Shorten to fit on the overflowing essay page
// (04). For each it screenshots the page before and after, prints the run's
// line, the tools it used and the ledger's spend, and for Tidy and Make bullets
// diffs the issue's words before and after (richTextToPlain): they must match.
//
// SAFETY: shared dev database. It mints its own admin, session and one draft
// per preset (seed images by their real rows, never copied). The finally deletes
// those rows and their ai_usage, after printing what they cost.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";
import postgres from "postgres";
import { buildIssues } from "../src/db/seed-data";
import { SEED_IMAGES, type SeedImages } from "../src/db/seed/images";
import type { Block, IssueContent } from "../src/lib/blocks";
import { markdownToDoc } from "../src/lib/markdown-doc";
import { richTextToPlain } from "../src/lib/rich-text-doc";
import {
  PRESETS,
  type PresetId,
} from "../src/features/editor/assistant/presets";

process.loadEnvFile?.(".env.local");
const [base, shots = ".data/assistant-presets"] = process.argv.slice(2);
if (!base)
  throw new Error("usage: dev-assistant-presets.mts <url> [shots-dir]");
mkdirSync(shots, { recursive: true });
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const tag = `assistant-presets-${crypto.randomUUID().slice(0, 8)}`;
const adminId = crypto.randomUUID();
const token = crypto.randomUUID();
const LOG = '[role="log"]';

type Case = { preset: PresetId; spike: string; select?: "second-text" };
const CASES: Case[] = [
  { preset: "tidy", spike: "01-tidy-notices" },
  { preset: "bullets", spike: "02-make-bullets" },
  { preset: "rewrite", spike: "11-rewrite-paragraph", select: "second-text" },
  { preset: "shorten", spike: "04-shorten-to-fit" },
];
type Spike = {
  issue: number;
  page: number;
  setup?: {
    replacePage?: {
      page: number;
      blocks: { kind: "text"; markdown: string }[];
    };
    appendToPage?: {
      page: number;
      blocks: { kind: "text"; markdown: string }[];
    };
  };
};

const textBlock = (markdown: string) =>
  ({
    id: crypto.randomUUID(),
    type: "text",
    text: markdownToDoc(markdown).doc,
  }) as Block;

/** The issue's words, in order: headings and body text, as members read them. */
const words = (content: IssueContent) =>
  content.pages
    .flatMap((p) => p.blocks)
    .flatMap((b) =>
      b.type === "heading"
        ? [b.kicker, b.title]
        : b.type === "text"
          ? [richTextToPlain(b.text)]
          : [],
    )
    .join(" ")
    .split(/\s+/)
    .filter(Boolean);

/** Tokens only in `a` and only in `b`, by longest common subsequence. */
function wordDiff(a: string[], b: string[]) {
  const n = a.length;
  const m = b.length;
  const lcs = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i]![j] =
        a[i] === b[j]
          ? lcs[i + 1]![j + 1]! + 1
          : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
  const removed: string[] = [];
  const added: string[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) removed.push(a[i++]!);
    else added.push(b[j++]!);
  }
  return {
    removed: [...removed, ...a.slice(i)],
    added: [...added, ...b.slice(j)],
  };
}

async function saved(id: string): Promise<IssueContent> {
  const [row] = await sql<{ content: IssueContent }[]>`
    select content from issues where id = ${id}`;
  return row!.content;
}

async function runCase(page: Page, c: Case, issueId: string, pageNo: number) {
  const label = PRESETS.find((p) => p.id === c.preset)!.label;
  console.log(
    `\n── ${label} (spike ${c.spike}, page ${pageNo}) `.padEnd(74, "─"),
  );
  await page.goto(`${base}/admin/issues/${issueId}/edit`);
  await page.waitForSelector('button[aria-label="Assistant"]');
  await page.click(`button[aria-label="Page ${pageNo}"]`);
  const before = await saved(issueId);
  if (c.select) {
    const texts = before.pages[pageNo - 1]!.blocks.filter(
      (b) => b.type === "text",
    );
    const target = texts[1] ?? texts[0]!;
    await page.click(`[data-block-id="${target.id}"]`);
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  }
  await page.click('button[aria-label="Assistant"]');
  await page.waitForSelector("#assistant-input");
  await page.waitForTimeout(800); // the panel's slide
  await page.screenshot({ path: join(shots, `${c.preset}-before.png`) });
  const started = Date.now();
  await page.click(`button:text-is("${label}")`);
  await page.waitForFunction(
    (sel) => document.querySelector(sel)?.getAttribute("aria-busy") === "true",
    LOG,
  );
  await page.waitForFunction(
    (sel) => document.querySelector(sel)?.getAttribute("aria-busy") === "false",
    LOG,
    { timeout: 300_000 },
  );
  const seconds = Math.round((Date.now() - started) / 1000);
  // Let the autosave land, then give it a moment more to settle.
  const end = Date.now() + 20_000;
  let after = await saved(issueId);
  while (JSON.stringify(after) === JSON.stringify(before) && Date.now() < end) {
    await new Promise((r) => setTimeout(r, 500));
    after = await saved(issueId);
  }
  await new Promise((r) => setTimeout(r, 3000));
  after = await saved(issueId);
  await page.screenshot({ path: join(shots, `${c.preset}-after.png`) });
  const log = (await page.textContent(LOG)) ?? "";
  const run = await page.$("[data-assistant-run]");
  const line = (await run?.textContent())?.trim() ?? "(no change line)";
  const [spend] = await sql<
    { cost: string; requests: number; tokens: number }[]
  >`
    select coalesce(sum(cost_usd), 0)::text as cost, count(*)::int as requests,
      coalesce(sum(prompt_tokens + cache_read_tokens + cache_write_tokens + completion_tokens), 0)::int as tokens
    from ai_usage where issue_id = ${issueId}`;
  const diff = wordDiff(words(before), words(after));
  const result = {
    preset: label,
    page: pageNo,
    seconds,
    line,
    cost: spend!.cost,
    requests: spend!.requests,
    tokens: spend!.tokens,
    pagesBefore: before.pages.length,
    pagesAfter: after.pages.length,
    wordsRemoved: diff.removed.length,
    wordsAdded: diff.added.length,
    diff,
    log,
  };
  console.log(
    `  ${seconds}s · $${Number(spend!.cost).toFixed(4)} · ${spend!.requests} requests · ${spend!.tokens} tokens`,
  );
  console.log(`  run line: ${line}`);
  console.log(
    `  words: −${diff.removed.length} +${diff.added.length}${diff.removed.length + diff.added.length ? ` (−${diff.removed.slice(0, 12).join(" ")} | +${diff.added.slice(0, 12).join(" ")})` : ""}`,
  );
  if (c.preset === "tidy" || c.preset === "bullets")
    console.log(
      `  wording ${diff.removed.length + diff.added.length === 0 ? "UNCHANGED" : "CHANGED"} (${label} must keep every word)`,
    );
  return result;
}

const browser = await chromium.launch();
const drafts: string[] = [];
const results: unknown[] = [];
try {
  await sql`insert into users (id, email, is_admin, subscribed, email_verified)
    values (${adminId}, ${`${tag}@example.invalid`}, true, false, now())`;
  await sql`insert into sessions (session_token, user_id, expires)
    values (${token}, ${adminId}, now() + interval '1 hour')`;
  const rows = await sql<{ id: string; key: string }[]>`
    select id, key from images where key like 'seed/%'`;
  const ids = Object.fromEntries(
    SEED_IMAGES.map((s) => [
      s.key,
      rows.find((r) => r.key === `seed/${s.key}.webp`)?.id,
    ]),
  ) as SeedImages;
  if (Object.values(ids).some((id) => !id))
    throw new Error("the seed images aren't in this database");
  const issues = buildIssues(ids);

  const ctx = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
  });
  await ctx.addCookies([
    {
      name: "authjs.session-token",
      value: token,
      url: base,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const page = await ctx.newPage();
  for (const c of CASES) {
    const spike = JSON.parse(
      readFileSync(`scripts/spike/assistant/cases/${c.spike}.json`, "utf8"),
    ) as Spike;
    const content = structuredClone(issues[spike.issue]!.content);
    const { replacePage, appendToPage } = spike.setup ?? {};
    if (replacePage)
      content.pages[replacePage.page - 1]!.blocks = replacePage.blocks.map(
        (b) => textBlock(b.markdown),
      );
    if (appendToPage)
      content.pages[appendToPage.page - 1]!.blocks.push(
        ...appendToPage.blocks.map((b) => textBlock(b.markdown)),
      );
    const id = crypto.randomUUID();
    drafts.push(id);
    await sql`insert into issues (id, title, theme, status, content) values
      (${id}, ${`${tag} ${c.preset}`}, ${issues[spike.issue]!.theme}, 'draft', ${sql.json(content as never)})`;
    results.push(await runCase(page, c, id, spike.page));
  }
  writeFileSync(join(shots, "results.json"), JSON.stringify(results, null, 2));
  console.log(`\nscreenshots and results.json in ${shots}`);
} finally {
  await browser.close();
  if (drafts.length) {
    const [total] = await sql<{ cost: string; requests: number }[]>`
      select coalesce(sum(cost_usd), 0)::text as cost, count(*)::int as requests
      from ai_usage where issue_id in ${sql(drafts)}`;
    console.log(
      `ledger total: $${total!.cost} over ${total!.requests} requests`,
    );
    await sql`delete from ai_usage where issue_id in ${sql(drafts)} or user_id = ${adminId}`;
    await sql`delete from issues where id in ${sql(drafts)}`;
  }
  await sql`delete from sessions where user_id = ${adminId}`;
  await sql`delete from users where id = ${adminId}`;
  await sql.end();
}
