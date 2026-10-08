// The body of check-assistant-models.mts (#315); see that file for usage.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { AI_PROVIDERS } from "../../src/lib/env.ts";
import { RUN_CALL_LIMIT } from "../../src/features/editor/assistant/executor.ts";
import { RUN_SPEND_CAP_USD } from "../../src/lib/ai-pricing.ts";
import {
  createAssistantModel,
  type AssistantEffort,
  type AssistantProvider,
} from "../../src/server/ai-provider.ts";
import { pageView } from "../../src/features/editor/assistant/projection.ts";
import {
  loadCases,
  startingIssue,
  type Case,
} from "../fixtures/assistant/cases.mts";
import { runCase } from "./conversation.mts";
import { confirmSpend, describeEstimate, estimate } from "./cost.mts";
import { assistantIssue, configureFor } from "./issue.mts";
import { MeasureBrowser } from "./measure.mts";
import { PrintRenderer } from "./render.mts";
import { summary, verdict, type CaseResults, type Result } from "./report.mts";
import { scoreCase } from "./score.mts";

process.loadEnvFile?.(".env.local");
const { values } = parseArgs({
  options: {
    // No default: a run that could spend must name its provider.
    provider: { type: "string" },
    model: { type: "string" },
    repeat: { type: "string", default: "1" },
    case: { type: "string" },
    photos: { type: "string" },
    app: { type: "string", default: "http://localhost:3000" },
    yes: { type: "boolean", default: false },
    resume: { type: "string" },
    // A sweep's knobs: the product's values unless given.
    effort: { type: "string" },
    "call-limit": { type: "string" },
    "run-cap": { type: "string" },
  },
});

const provider = values.provider as AssistantProvider;
if (!AI_PROVIDERS.includes(provider)) {
  console.error(
    `--provider is required, one of ${AI_PROVIDERS.join(", ")} (fake is free)`,
  );
  process.exit(1);
}
const KEYS: Record<AssistantProvider, string | undefined> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  fake: undefined,
};
const keyName = KEYS[provider];
const apiKey = keyName ? process.env[keyName] : undefined;
if (keyName && !apiKey) {
  console.log(`Skipped: ${keyName} isn't set, so there's no ${provider} run.`);
  process.exit(provider === "openrouter" ? 0 : 1);
}
const EFFORTS = ["low", "medium", "high"] as const;
const effort = values.effort as AssistantEffort | undefined;
if (effort && !EFFORTS.includes(effort)) {
  console.error(`--effort is one of ${EFFORTS.join(", ")}`);
  process.exit(1);
}
const callLimit = Number(values["call-limit"] ?? RUN_CALL_LIMIT);
const runCapUsd = Number(values["run-cap"] ?? RUN_SPEND_CAP_USD);
if (!(callLimit >= 1) || !(runCapUsd > 0)) {
  console.error("--call-limit and --run-cap take positive numbers");
  process.exit(1);
}
const model = createAssistantModel({
  provider,
  modelId: values.model,
  apiKey,
  effort,
});
// Results name what was varied, so a sweep's batches sit side by side.
const knobs = [
  effort && `effort-${effort}`,
  values["call-limit"] && `calls-${callLimit}`,
  values["run-cap"] && `cap-${runCapUsd}`,
].filter(Boolean);
const repeat = Math.max(1, Number(values.repeat) || 1);

// Tool families the route doesn't declare yet; their cases wait for them.
const MISSING: Record<string, string> = {};
const wanted = values.case?.split(",").map((s) => s.trim());
const cases = loadCases().filter(
  (c) => !wanted || wanted.some((w) => c.id.startsWith(w)),
);
const skipReason = (c: Case) =>
  (c.requires ?? [])
    .map((r) => MISSING[r])
    .filter(Boolean)
    .join("; ") || undefined;
const runnable = cases.filter((c) => !skipReason(c));

if (provider !== "fake") {
  const e = estimate(model.modelId, runnable, repeat, runCapUsd);
  if (!(await confirmSpend(describeEstimate(model.modelId, e), values.yes))) {
    console.log("Nothing spent.");
    process.exit(0);
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
// --resume <dir> finishes a batch that stopped: saved runs are reused as scored.
const outDir = values.resume
  ? resolve(values.resume)
  : join(
      import.meta.dirname,
      "results",
      [model.modelId.replace(/[^\w.-]/g, "_"), ...knobs, stamp].join("-"),
    );
mkdirSync(outDir, { recursive: true });

function saved(dir: string): Result | null {
  if (!values.resume || !existsSync(join(dir, "run.json"))) return null;
  const { score, ...run } = JSON.parse(
    readFileSync(join(dir, "run.json"), "utf8"),
  );
  return {
    score,
    run: {
      ...run,
      pages: run.pages ?? [],
      projection: readFileSync(join(dir, "projection.txt"), "utf8"),
    },
  };
}

// The SDK can reject a stray promise after a failure the run already recorded.
process.on("unhandledRejection", (e) =>
  console.warn(
    `  (after a failed request: ${e instanceof Error ? e.message : e})`,
  ),
);

const browser = await MeasureBrowser.open(values.app);
const renderer = new PrintRenderer(browser.browser, values.app);
const all: CaseResults[] = [];
try {
  for (const c of cases) {
    const skipped = skipReason(c);
    const entry: CaseResults = { c, skipped, results: [] };
    all.push(entry);
    if (skipped) {
      console.log(`${c.id}: SKIPPED — ${skipped}`);
      continue;
    }
    for (let r = 1; r <= repeat; r++) {
      const dir = join(outDir, c.id, `r${r}`);
      const kept = saved(dir);
      if (kept) {
        entry.results.push(kept);
        console.log(`${c.id} #${r} … saved`);
        continue;
      }
      const issue = await startingIssue(
        c,
        values.photos && resolve(values.photos),
      );
      await configureFor(browser, issue);
      process.stdout.write(`${c.id}${repeat > 1 ? ` #${r}` : ""} … `);
      const run = await runCase({
        c,
        issue,
        browser,
        renderer,
        model,
        callLimit,
        runCapUsd,
      });
      const fills = await browser.fills(run.pages);
      const score = scoreCase(c, issue.pages, run, fills);
      entry.results.push({ run, score });
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "projection.txt"), run.projection);
      writeFileSync(
        join(dir, "run.json"),
        JSON.stringify({ score, ...run, projection: undefined }, null, 2),
      );
      const after = await assistantIssue(issue, run.pages, browser);
      writeFileSync(
        join(dir, "after.md"),
        run.pages.map((_, i) => pageView(after, i + 1)).join("\n\n"),
      );
      await renderer.shoot(issue, run.pages, join(dir, "pages"));
      console.log(
        `${score.pass ? "PASS" : "FAIL"} · ${score.calls} calls · ${Math.round(run.ms / 1000)}s${score.failures.length ? ` · ${score.failures.join("; ")}` : ""}`,
      );
    }
  }
} finally {
  await renderer.close();
  await browser.close();
}

const title = [
  provider,
  model.modelId,
  `effort ${model.reasoning}`,
  `≤${callLimit} calls`,
  `$${runCapUsd.toFixed(2)} a run`,
  `×${repeat}`,
  stamp,
].join(" · ");
const text = summary(title, all);
writeFileSync(join(outDir, "summary.md"), `${text}\n`);
writeFileSync(
  join(outDir, "results.json"),
  JSON.stringify(
    {
      provider,
      model: model.modelId,
      effort: model.reasoning,
      callLimit,
      runCapUsd,
      repeat,
      verdict: verdict(all),
      cases: all.map(({ c, skipped, results }) => ({
        id: c.id,
        expectation: c.expectation,
        skipped,
        runs: results.map(({ run, score }) => ({
          score,
          requests: run.requests,
          stopped: run.stopped,
          tripped: run.tripped,
          ms: run.ms,
        })),
      })),
    },
    null,
    2,
  ),
);
console.log(`\n${text}\n\nResults: ${outDir}`);
process.exit(0);
