// Runs the spike's cases through a real Claude model via Claude Code headless:
// the system prompt replaced by prompt.md, every built-in tool removed, our
// tools served by mcp-server.mts, the projection + instruction as the user
// message. Scores each case and writes results/<model>-<timestamp>/.
//
//   npx tsx --tsconfig scripts/tsconfig.json scripts/spike/assistant/run.mts \
//     --model haiku [--case 03-overflow-split[,05-move-photo]] [--dry-run] [--save-draft]
//
// --dry-run builds each case's state, projection and message without calling
// the model (free). Real runs spend the logged-in Claude subscription.
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { loadCases, startingContext, userMessage, type Case } from "./cases.ts";
import { estimateFill, describeFill } from "./fill.ts";
import { pageView, projection } from "./projection.ts";
import { saveDraft } from "./save-draft.ts";
import { scoreCase, type LoggedCall, type Score } from "./score.ts";
import {
  fromStateFile,
  toStateFile,
  type IssueContext,
  type StateFile,
} from "./seed.ts";
import { TOOL_NAMES } from "./tools.ts";

const HERE = import.meta.dirname;
const ROOT = join(HERE, "../../..");
const SERVER = "octavo";
const TIMEOUT_MS = 8 * 60_000;

const { values } = parseArgs({
  options: {
    model: { type: "string", default: "haiku" },
    case: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    "save-draft": { type: "boolean", default: false },
  },
});
const model = values.model!;
const wanted = values.case?.split(",").map((s) => s.trim());
const cases = loadCases().filter(
  (c) => !wanted || wanted.some((w) => c.id.startsWith(w)),
);
if (!cases.length) throw new Error(`no case matches ${values.case}`);

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = join(
  HERE,
  "results",
  `${model.replace(/[^\w.-]/g, "_")}-${stamp}${values["dry-run"] ? "-dry" : ""}`,
);
mkdirSync(outDir, { recursive: true });
const systemPrompt = readFileSync(join(HERE, "prompt.md"), "utf8");

/** Every page in full, for the before/after dumps. */
const dump = (ctx: IssueContext) =>
  ctx.content.pages.map((_, i) => pageView(ctx, i + 1)).join("\n\n");

type RunResult = {
  finalText: string;
  costUsd: number | null;
  usage: Record<string, number>;
  turns: number | null;
  durationMs: number;
  toolUses: number;
  error?: string;
};

function runClaude(dir: string, message: string): Promise<RunResult> {
  const mcpConfig = join(dir, "mcp.json");
  writeFileSync(
    mcpConfig,
    JSON.stringify({
      mcpServers: {
        [SERVER]: {
          command: join(ROOT, "node_modules/.bin/tsx"),
          args: [
            "--tsconfig",
            join(ROOT, "scripts/tsconfig.json"),
            join(HERE, "mcp-server.mts"),
          ],
          env: {
            SPIKE_STATE: join(dir, "state.json"),
            SPIKE_LOG: join(dir, "calls.jsonl"),
          },
        },
      },
    }),
  );
  const args = [
    "-p",
    "--model",
    model,
    "--system-prompt",
    systemPrompt,
    "--tools",
    "",
    "--strict-mcp-config",
    "--mcp-config",
    mcpConfig,
    "--setting-sources",
    "",
    "--allowedTools",
    TOOL_NAMES.map((t) => `mcp__${SERVER}__${t}`).join(","),
    "--output-format",
    "stream-json",
    "--verbose",
    "--no-session-persistence",
  ];
  const env = { ...process.env };
  delete env.CLAUDECODE; // a nested `claude -p` refuses to start otherwise
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn("claude", args, {
      cwd: dir,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    const timer = setTimeout(() => child.kill("SIGTERM"), TIMEOUT_MS);
    child.stdin.end(message);
    child.on("close", (code) => {
      clearTimeout(timer);
      writeFileSync(join(dir, "transcript.jsonl"), out);
      if (err) writeFileSync(join(dir, "stderr.txt"), err);
      const events = out
        .split("\n")
        .filter(Boolean)
        .flatMap((l) => {
          try {
            return [JSON.parse(l) as Record<string, unknown>];
          } catch {
            return [];
          }
        });
      const toolUses = events
        .filter((e) => e.type === "assistant")
        .flatMap((e) =>
          (
            (e.message as { content?: { type: string }[] })?.content ?? []
          ).filter((c) => c.type === "tool_use"),
        ).length;
      const result = events.find((e) => e.type === "result") as
        | Record<string, unknown>
        | undefined;
      resolve({
        finalText: String(result?.result ?? ""),
        costUsd:
          typeof result?.total_cost_usd === "number"
            ? result.total_cost_usd
            : null,
        usage: (result?.usage as Record<string, number>) ?? {},
        turns: typeof result?.num_turns === "number" ? result.num_turns : null,
        durationMs: Date.now() - started,
        toolUses,
        error:
          code === 0 && result && !result.is_error
            ? undefined
            : `exit ${code}${result?.is_error ? ` · ${String(result.subtype)}` : ""}${err ? ` · ${err.slice(0, 300)}` : ""}`,
      });
    });
  });
}

type Row = { c: Case; score?: Score; run?: RunResult; startFill: string };
const rows: Row[] = [];

for (const c of cases) {
  const dir = join(outDir, c.id);
  mkdirSync(dir, { recursive: true });
  const ctx = startingContext(c);
  const before = structuredClone(ctx.content);
  const startFill = describeFill(
    estimateFill(ctx.content.pages[c.page - 1]!, ctx.images),
  );
  const message = userMessage(projection(ctx, c.page), c);
  writeFileSync(join(dir, "state.json"), JSON.stringify(toStateFile(ctx)));
  writeFileSync(join(dir, "calls.jsonl"), "");
  writeFileSync(join(dir, "message.txt"), message);
  writeFileSync(join(dir, "before.md"), dump(ctx));
  if (values["dry-run"]) {
    console.log(
      `${c.id}: page ${c.page} starts ${startFill}; message ${message.length} chars`,
    );
    rows.push({ c, startFill });
    continue;
  }

  process.stdout.write(`${c.id} (${model}) … `);
  const run = await runClaude(dir, message);
  const after = fromStateFile(
    JSON.parse(readFileSync(join(dir, "state.json"), "utf8")) as StateFile,
  );
  const calls = readFileSync(join(dir, "calls.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as LoggedCall);
  const score = scoreCase(
    c,
    before,
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
  writeFileSync(
    join(dir, "score.json"),
    JSON.stringify({ case: c.id, model, startFill, score, run }, null, 2),
  );
  console.log(
    `${score.pass ? "PASS" : "FAIL"} · ${score.calls} calls · ${(run.durationMs / 1000).toFixed(0)}s${score.failures.length ? ` · ${score.failures.join("; ")}` : ""}`,
  );
  if (values["save-draft"]) {
    const id = await saveDraft(after, `Spike · ${c.id} · ${model}`);
    console.log(`  saved as draft ${id} — /admin/issues/${id}/edit`);
  }
  rows.push({ c, score, run, startFill });
}

// --- Summary table -------------------------------------------------------------

const k = (n: number | undefined) =>
  n === undefined ? "–" : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
const header =
  "| case | pass | calls (max) | valid | wording | overflow | blocks changed | advisory | time | cost | in / cache read / cache write / out tokens |";
const lines = [
  `### ${model} · ${stamp}`,
  "",
  header,
  "|---|---|---|---|---|---|---|---|---|---|---|",
  ...rows.map(({ c, score: s, run: r }) =>
    s && r
      ? `| ${c.id} | ${s.pass ? "✅" : "❌"} | ${s.calls} (${c.expect.maxCalls}) | ${s.validPct}% | ${s.preserve.mode === "none" ? "–" : s.preserve.ok ? "kept" : "changed"} | ${s.overflowPages.length ? `p${s.overflowPages.join(",")}` : "none"} | ${s.changedBlocks} | ${[...(s.toolsMissing.length ? [`unused: ${s.toolsMissing.join(", ")}`] : []), ...s.advisories].join("; ") || "–"} | ${(r.durationMs / 1000).toFixed(0)}s | ${r.costUsd === null ? "–" : `$${r.costUsd.toFixed(3)}`} | ${k(r.usage.input_tokens)} / ${k(r.usage.cache_read_input_tokens)} / ${k(r.usage.cache_creation_input_tokens)} / ${k(r.usage.output_tokens)} |`
      : `| ${c.id} | dry run | – | – | – | – | – | – | – | – | – |`,
  ),
];
const scored = rows.filter((r) => r.score && r.run);
if (scored.length) {
  const passed = scored.filter((r) => r.score!.pass).length;
  const calls = scored.reduce((a, r) => a + r.score!.calls, 0);
  const valid = scored.reduce(
    (a, r) => a + (r.score!.validPct * r.score!.calls) / 100,
    0,
  );
  const cost = scored.reduce((a, r) => a + (r.run!.costUsd ?? 0), 0);
  lines.push(
    "",
    `**${passed}/${scored.length} passed** · ${calls} tool calls, ${calls ? Math.round((valid / calls) * 100) : 100}% valid · $${cost.toFixed(2)} list-price total`,
  );
  lines.push(
    "",
    "Failures:",
    ...scored
      .filter((r) => !r.score!.pass)
      .map((r) => `- ${r.c.id}: ${r.score!.failures.join("; ")}`),
  );
}
writeFileSync(join(outDir, "summary.md"), `${lines.join("\n")}\n`);
console.log(`\n${lines.join("\n")}\n\nResults: ${outDir}`);
process.exit(0);
