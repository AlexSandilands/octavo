// The run's summary table (results/<run>/summary.md and the console).
import type { Case } from "./cases.ts";
import type { RunResult } from "./claude.ts";
import type { Score } from "./score.ts";

export type Row = {
  c: Case;
  score?: Score;
  run?: RunResult;
  startFill: string;
  /** Views the model took (view_page + view_photo). */
  views?: number;
  viewBudget?: number;
  /** The review turn, when --review ran one. */
  review?: {
    pages: number[];
    calls: number;
    names: string[];
    firstCostUsd: number | null;
    reviewCostUsd: number | null;
  };
  /** Interior pages the rendered DOM says overflow (the real measurer's verdict). */
  measuredOverflow?: number[] | null;
};

const k = (n: number | undefined) =>
  n === undefined ? "–" : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
export const seconds = (ms: number | null) =>
  ms === null ? "–" : `${(ms / 1000).toFixed(0)}s`;

export function summary(title: string, rows: Row[]): string {
  const lines = [
    `### ${title}`,
    "",
    "| case | pass | calls (max) | valid | views | wording | overflow est. | overflow measured | blocks changed | advisory | time (api) | cost | in / cache read / cache write / out tokens |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...rows.map(
      ({ c, score: s, run: r, views, viewBudget, measuredOverflow: m }) =>
        s && r
          ? `| ${c.id} | ${s.pass ? "✅" : "❌"} | ${s.calls} (${c.expect.maxCalls}) | ${s.validPct}% | ${viewBudget ? `${views ?? 0} of ${viewBudget}` : "–"} | ${s.preserve.mode === "none" ? "–" : s.preserve.ok ? "kept" : "changed"}${s.pasteVerbatim === false ? " (not verbatim)" : ""} | ${s.overflowPages.length ? `p${s.overflowPages.join(",")}` : "none"} | ${m === undefined || m === null ? "–" : m.length ? `p${m.join(",")}` : "none"} | ${s.changedBlocks} | ${[...(s.toolsMissing.length ? [`unused: ${s.toolsMissing.join(", ")}`] : []), ...s.advisories].join("; ") || "–"} | ${seconds(r.durationMs)} (${seconds(r.apiMs ?? null)}) | ${r.costUsd === null ? "–" : `$${r.costUsd.toFixed(3)}`} | ${k(r.usage.input_tokens)} / ${k(r.usage.cache_read_input_tokens)} / ${k(r.usage.cache_creation_input_tokens)} / ${k(r.usage.output_tokens)} |`
          : `| ${c.id} | dry run | – | – | – | – | – | ${m === undefined || m === null ? "–" : m.length ? `p${m.join(",")}` : "none"} | – | – | – | – | – |`,
    ),
  ];
  const reviewed = rows.filter((r) => r.review);
  if (reviewed.length)
    lines.push(
      "",
      "Review turns:",
      ...reviewed.map(
        ({ c, review: v }) =>
          `- ${c.id}: shown p${v!.pages.join(", p")} · ${v!.calls} call${v!.calls === 1 ? "" : "s"}${v!.names.length ? ` (${v!.names.join(", ")})` : ""} · first turn $${v!.firstCostUsd?.toFixed(3)}, review turn $${v!.reviewCostUsd?.toFixed(3)}`,
      ),
    );
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
      "",
      "Failures:",
      ...scored
        .filter((r) => !r.score!.pass)
        .map((r) => `- ${r.c.id}: ${r.score!.failures.join("; ")}`),
    );
  }
  return lines.join("\n");
}
