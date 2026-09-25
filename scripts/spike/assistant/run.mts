// Runs the spike's cases through a real Claude model via Claude Code headless
// (claude.ts), scores each case and writes results/<model>-<timestamp>/.
//
//   npx tsx --tsconfig scripts/tsconfig.json scripts/spike/assistant/run.mts \
//     --model sonnet [--case 03,05] [--vision] [--cover | --cover-style] \
//     [--dry-run] [--save-draft]
//   … run.mts --rescore results/<dir>   (re-score a finished run, no model calls)
//
// --vision offers view_page/view_photo (6 views a run) and appends
// prompt-vision.md; --cover offers the compose-tier cover tools and
// --cover-style both tiers, appending prompt-cover.md. --dry-run builds each
// case's state, projection, message and page pictures without calling the
// model (free). Real runs spend the logged-in Claude subscription. Page
// pictures need the dev server (npm run dev) answering on :3000.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { loadCases, startingContext, userMessage, type Case } from "./cases.ts";
import { runClaude, type RunResult } from "./claude.ts";
import { coverToolsFor } from "./cover-tools.ts";
import { describeFill, estimateFill } from "./fill.ts";
import { pageView, projection } from "./projection.ts";
import { Renderer } from "./render.ts";
import { seconds, summary, type Row } from "./report.ts";
import { saveDraft } from "./save-draft.ts";
import { scoreCase, type LoggedCall, type Score } from "./score.ts";
import {
  fromStateFile,
  toStateFile,
  type IssueContext,
  type StateFile,
} from "./seed.ts";
import { TOOL_NAMES } from "./tools.ts";
import { VISION_TOOLS } from "./vision.ts";

const HERE = import.meta.dirname;
const VISION_BUDGET = 6;

const { values } = parseArgs({
  options: {
    model: { type: "string", default: "haiku" },
    case: { type: "string" },
    vision: { type: "boolean", default: false },
    /** Override the view budget (default: the case's expect.maxViews, else 6). */
    views: { type: "string" },
    cover: { type: "boolean", default: false },
    "cover-style": { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    "save-draft": { type: "boolean", default: false },
    rescore: { type: "string" },
  },
});
const model = values.model!;
const coverTier = values["cover-style"]
  ? "style"
  : values.cover
    ? "compose"
    : undefined;
const wanted = values.case?.split(",").map((s) => s.trim());
const cases = loadCases().filter(
  (c) => !wanted || wanted.some((w) => c.id.startsWith(w)),
);
if (!cases.length) throw new Error(`no case matches ${values.case}`);

const variant = [values.vision && "vision", coverTier && `cover-${coverTier}`]
  .filter(Boolean)
  .join("+");
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = values.rescore
  ? resolve(values.rescore)
  : join(
      HERE,
      "results",
      `${model.replace(/[^\w.-]/g, "_")}${variant ? `-${variant}` : ""}-${stamp}-${process.pid}${values["dry-run"] ? "-dry" : ""}`,
    );
mkdirSync(outDir, { recursive: true });

// The prompt is assembled from parts, as production would from enabled features.
const systemPrompt = [
  "prompt.md",
  ...(values.vision ? ["prompt-vision.md"] : []),
  ...(coverTier ? ["prompt-cover.md"] : []),
]
  .map((f) => readFileSync(join(HERE, f), "utf8").trim())
  .join("\n\n");
const tools = [
  ...TOOL_NAMES,
  ...coverToolsFor(coverTier),
  ...(values.vision ? VISION_TOOLS : []),
];

/** Every page in full, for the before/after dumps. */
const dump = (ctx: IssueContext) =>
  ctx.content.pages.map((_, i) => pageView(ctx, i + 1)).join("\n\n");

const renderer = new Renderer();
/** A picture of every page into `<dir>/<name>/`, and the pages the DOM says overflow. */
async function pictures(
  ctx: IssueContext,
  dir: string,
): Promise<number[] | null> {
  try {
    mkdirSync(dir, { recursive: true });
    const over: number[] = [];
    for (let n = 1; n <= ctx.content.pages.length; n++) {
      const { png, measured } = await renderer.shot(ctx, n);
      writeFileSync(join(dir, `p${String(n).padStart(2, "0")}.png`), png);
      if (measured && measured.overflowPx > 2) over.push(n);
    }
    return over;
  } catch (e) {
    console.warn(
      `  (no page pictures: ${e instanceof Error ? e.message : String(e)})`,
    );
    return null;
  }
}

const readState = (dir: string, file: string) =>
  fromStateFile(JSON.parse(readFileSync(join(dir, file), "utf8")) as StateFile);

function scoreDir(
  c: Case,
  dir: string,
  run: RunResult,
): { score: Score; calls: LoggedCall[] } {
  const before = readState(dir, "before.json");
  const after = readState(dir, "state.json");
  const calls = readFileSync(join(dir, "calls.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as LoggedCall);
  const score = scoreCase(
    c,
    before.content,
    after.content,
    calls,
    run.toolUses,
    after.images,
  );
  if (run.error) {
    score.failures.unshift(`run error: ${run.error}`);
    score.pass = false;
  }
  writeFileSync(join(dir, "after.md"), dump(after));
  return { score, calls };
}

const rows: Row[] = [];
for (const c of cases) {
  const dir = join(outDir, c.id);
  if (values.rescore) {
    if (!existsSync(join(dir, "before.json"))) continue;
    const saved = JSON.parse(
      readFileSync(join(dir, "score.json"), "utf8"),
    ) as Omit<Row, "c"> & { run: RunResult };
    const { score } = scoreDir(c, dir, saved.run);
    const measuredOverflow = await pictures(
      readState(dir, "state.json"),
      join(dir, "pages"),
    );
    const row = { ...saved, c, score, measuredOverflow };
    writeFileSync(
      join(dir, "score.json"),
      JSON.stringify({ ...row, c: undefined, case: c.id, model }, null, 2),
    );
    rows.push(row);
    continue;
  }
  mkdirSync(dir, { recursive: true });
  const ctx = await startingContext(c);
  ctx.coverTools = coverTier;
  const startFill = describeFill(
    estimateFill(ctx.content.pages[c.page - 1]!, ctx.images),
  );
  const message = userMessage(projection(ctx, c.page), c);
  writeFileSync(join(dir, "before.json"), JSON.stringify(toStateFile(ctx)));
  writeFileSync(join(dir, "state.json"), JSON.stringify(toStateFile(ctx)));
  writeFileSync(join(dir, "calls.jsonl"), "");
  writeFileSync(join(dir, "message.txt"), message);
  writeFileSync(join(dir, "prompt.txt"), systemPrompt);
  writeFileSync(join(dir, "before.md"), dump(ctx));
  if (values["dry-run"]) {
    const measuredOverflow = await pictures(ctx, join(dir, "before-pages"));
    console.log(
      `${c.id}: page ${c.page} starts ${startFill}; message ${message.length} chars; prompt ${systemPrompt.length} chars`,
    );
    rows.push({ c, startFill, measuredOverflow });
    continue;
  }

  const budget = values.vision
    ? Number(values.views ?? c.expect.maxViews ?? VISION_BUDGET)
    : 0;
  process.stdout.write(
    `${c.id} (${model}${variant ? ` · ${variant}` : ""}) … `,
  );
  const run = await runClaude({
    dir,
    model,
    systemPrompt,
    message,
    tools,
    visionBudget: budget,
  });
  const { score, calls } = scoreDir(c, dir, run);
  const after = readState(dir, "state.json");
  const measuredOverflow = await pictures(after, join(dir, "pages"));
  const views = calls.filter((x) => (x as { image?: boolean }).image).length;
  const row: Row = {
    c,
    score,
    run,
    startFill,
    views,
    viewBudget: budget,
    measuredOverflow,
  };
  writeFileSync(
    join(dir, "score.json"),
    JSON.stringify(
      { ...row, c: undefined, case: c.id, model, variant },
      null,
      2,
    ),
  );
  console.log(
    `${score.pass ? "PASS" : "FAIL"} · ${score.calls} calls · ${views} views · ${seconds(run.durationMs)}${score.failures.length ? ` · ${score.failures.join("; ")}` : ""}`,
  );
  if (values["save-draft"]) {
    const saved = await saveDraft(
      after,
      `Spike · ${c.id} · ${model}${variant ? ` · ${variant}` : ""}`,
      dir,
    );
    console.log(`  saved as draft ${saved} — /admin/issues/${saved}/edit`);
  }
  rows.push(row);
}
await renderer.close();

const text = summary(
  `${model}${variant ? ` · ${variant}` : ""} · ${stamp}`,
  rows,
);
writeFileSync(join(outDir, "summary.md"), `${text}\n`);
console.log(`\n${text}\n\nResults: ${outDir}`);
process.exit(0);
