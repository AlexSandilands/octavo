// The table and verdict a model run prints (#315), per case over its repeats,
// with the spread: one spike case swung between 4 and 14 calls run to run.
import type { Case } from "../fixtures/assistant/cases.mts";
import type { CaseRun } from "./conversation.mts";
import type { Score } from "./score.mts";

export type Result = { run: CaseRun; score: Score };
export type CaseResults = { c: Case; skipped?: string; results: Result[] };

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const spread = (xs: number[], f = (n: number) => String(n)) => {
  if (!xs.length) return "–";
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  return lo === hi ? f(lo) : `${f(lo)}–${f(hi)}`;
};
const secs = (ms: number) => `${Math.round(ms / 1000)}s`;
const usd = (n: number) => `$${n.toFixed(3)}`;
const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
const cost = (r: Result) => sum(r.run.requests.map((q) => q.costUsd));
const cacheRead = (r: Result) => sum(r.run.requests.map((q) => q.cacheRead));

function row({ c, skipped, results }: CaseResults): string {
  if (skipped)
    return `| ${c.id} | SKIPPED | – | – | – | – | – | – | – | – | ${skipped} |`;
  const passed = results.filter((r) => r.score.pass).length;
  const notes = [
    ...new Set(
      results.flatMap((r) => [...r.score.failures, ...r.score.advisories]),
    ),
  ];
  const wording = results.every((r) => r.score.wording.ok)
    ? c.expect.preserve === "none"
      ? "–"
      : "kept"
    : "changed";
  const overflow = results.some((r) => r.score.overflowPages.length)
    ? "yes"
    : "none";
  return [
    "",
    c.id,
    `${passed === results.length ? "✅" : passed ? "⚠️" : "❌"} ${passed}/${results.length}`,
    `${spread(results.map((r) => r.score.calls))} (${c.expect.maxCalls})`,
    `${Math.min(...results.map((r) => r.score.validPct))}%`,
    wording,
    overflow,
    spread(results.map((r) => r.score.views)),
    spread(
      results.map((r) => r.run.ms),
      secs,
    ),
    spread(results.map(cost), usd),
    spread(results.map(cacheRead), k),
    notes.join("; ").replace(/\|/g, "/") || "–",
    "",
  ]
    .join(" | ")
    .trim();
}

export type Verdict = { fit: boolean; why: string[] };

/**
 * Fit to be AI_MODEL: every runnable case passes in a majority of its repeats,
 * at least 95% of calls are schema-valid, and no run hit the breaker, the run
 * cap or an error. The PNGs still need a human look.
 */
export function verdict(all: CaseResults[]): Verdict {
  const why: string[] = [];
  const ran = all.filter((x) => !x.skipped);
  for (const { c, results } of ran) {
    const passed = results.filter((r) => r.score.pass).length;
    if (passed * 2 <= results.length)
      why.push(`${c.id} passed ${passed}/${results.length}`);
    const stopped = results.find((r) => r.run.stopped);
    if (stopped) why.push(`${c.id}: ${stopped.run.stopped}`);
  }
  const calls = ran.flatMap((x) => x.results.flatMap((r) => r.run.calls));
  const valid = calls.length
    ? calls.filter((x) => x.valid).length / calls.length
    : 1;
  if (valid < 0.95)
    why.push(`${Math.round(valid * 100)}% of calls schema-valid`);
  return { fit: ran.length > 0 && why.length === 0, why };
}

export function summary(title: string, all: CaseResults[]): string {
  const ran = all.filter((x) => !x.skipped).flatMap((x) => x.results);
  const v = verdict(all);
  const head = [
    `### ${title}`,
    "",
    `${ran.filter((r) => r.score.pass).length}/${ran.length} runs pass · ${sum(ran.map((r) => r.score.calls))} calls · ${usd(sum(ran.map(cost)))} · cache read ${k(sum(ran.map(cacheRead)))} tokens`,
    "",
    `**Verdict: ${v.fit ? "fit to be AI_MODEL" : "not fit"}**${v.why.length ? ` — ${v.why.join("; ")}` : ""}. Covers and layout still need a look at the PNGs.`,
    "",
    "| case | pass | calls (max) | valid | wording | overflow | views | time | cost | cache read | notes |",
    "| ---- | ---- | ----------- | ----- | ------- | -------- | ----- | ---- | ---- | ---------- | ----- |",
  ];
  return [...head, ...all.map(row)].join("\n");
}
