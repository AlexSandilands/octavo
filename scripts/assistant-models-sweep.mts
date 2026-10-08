// Compares model-selection batches run with --effort / --call-limit (one row per
// batch) and re-scores each at lower call ceilings. The model is never told
// the ceiling, so a run that finished in N calls would have gone the same way
// under any ceiling of N or more; past it, it would have been stopped (a fail).
// The case's own call budget is dropped: the ceiling stands in for it.
// Run: npx tsx scripts/assistant-models-sweep.mts <results dir>… [--ceilings 40,60,100]
import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parseArgs } from "node:util";

type Run = {
  score: {
    pass: boolean;
    failures: string[];
    falseClaims: string[];
    calls: number;
    validPct: number;
    wording: { change?: string };
  };
  requests: { costUsd: number }[];
  tripped?: "calls" | "moves" | "stall";
  ms: number;
};
type Batch = {
  model: string;
  effort?: string;
  callLimit?: number;
  cases: { id: string; skipped?: string; runs: Run[] }[];
};

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { ceilings: { type: "string", default: "40,60,100" } },
});
const ceilings = values.ceilings.split(",").map(Number);

const BUDGET = /^\d+ calls > max \d+$/;
const CALL_TRIP = /^stopped: circuit-breaker/;

/** Passed under a ceiling of `limit` calls, the case budget aside. */
function passesAt(run: Run, limit: number): boolean {
  if (run.score.calls > limit) return false;
  return run.score.failures.every(
    (f) => BUDGET.test(f) || (run.tripped === "calls" && CALL_TRIP.test(f)),
  );
}

const usd = (n: number) => `$${n.toFixed(n < 1 ? 3 : 2)}`;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

const rows: string[] = [];
const perCase = new Map<string, Map<string, string>>();
for (const dir of positionals) {
  const b: Batch = JSON.parse(readFileSync(join(dir, "results.json"), "utf8"));
  const label = `${b.model.replace(/^claude-/, "")} · ${b.effort ?? "medium"}`;
  const runs = b.cases.filter((c) => !c.skipped).flatMap((c) => c.runs);
  const cost = runs.reduce(
    (s, r) => s + r.requests.reduce((t, q) => t + q.costUsd, 0),
    0,
  );
  const trips = (rule: string) => runs.filter((r) => r.tripped === rule).length;
  const at = ceilings.map(
    (n) => `${runs.filter((r) => passesAt(r, n)).length}/${runs.length}`,
  );
  rows.push(
    `| ${label} | ${runs.filter((r) => r.score.pass).length}/${runs.length} | ${at.join(" | ")} | ${usd(cost)} | ${usd(cost / runs.length)} | ${median(runs.map((r) => r.score.calls))} | ${Math.round(median(runs.map((r) => r.ms)) / 1000)}s | ${runs.filter((r) => r.score.wording.change === "words").length} | ${runs.filter((r) => r.score.falseClaims.length).length} | ${trips("moves") + trips("stall")} | ${Math.round(runs.reduce((s, r) => s + r.score.validPct, 0) / runs.length)}% | ${basename(dir)} |`,
  );
  for (const c of b.cases) {
    if (c.skipped) continue;
    const top = Math.max(...ceilings);
    const cell = `${c.runs.filter((r) => passesAt(r, top)).length}/${c.runs.length} (${c.runs.map((r) => r.score.calls).join(",")})`;
    if (!perCase.has(c.id)) perCase.set(c.id, new Map());
    perCase.get(c.id)!.set(label, cell);
  }
}

console.log(
  `| batch | strict | ${ceilings.map((n) => `≤${n} calls`).join(" | ")} | cost | per run | median calls | median time | words changed | false claims | stuck trips | valid calls | results |`,
);
console.log(`|${" --- |".repeat(11 + ceilings.length)}`);
console.log(rows.join("\n"));

const labels = [
  ...new Set([...perCase.values()].flatMap((m) => [...m.keys()])),
];
console.log(
  `\nPer case, passing at ≤${Math.max(...ceilings)} calls (each run's calls):\n`,
);
console.log(`| case | ${labels.join(" | ")} |`);
console.log(`|${" --- |".repeat(labels.length + 1)}`);
for (const [id, m] of perCase)
  console.log(`| ${id} | ${labels.map((l) => m.get(l) ?? "–").join(" | ")} |`);
