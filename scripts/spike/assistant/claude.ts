// One headless Claude Code run: our system prompt instead of Claude Code's,
// every built-in tool removed, the spike's tools served by mcp-server.mts,
// the projection + instruction on stdin. Captures the stream-json transcript.
// With `review`, input is stream-json: after the model's first turn ends, the
// harness sends one more user message (the review: text + page images) in the
// same session, and the run ends after that second turn.
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const HERE = import.meta.dirname;
const ROOT = join(HERE, "../../..");
const SERVER = "octavo";
const TIMEOUT_MS = 8 * 60_000;

export type RunResult = {
  finalText: string;
  costUsd: number | null;
  usage: Record<string, number>;
  turns: number | null;
  durationMs: number;
  /** Time spent waiting on the API, per Claude Code — excludes tool execution. */
  apiMs: number | null;
  toolUses: number;
  /** Per-turn figures when a review turn ran. Costs are per turn, not cumulative. */
  review?: {
    firstCostUsd: number | null;
    reviewCostUsd: number | null;
    firstCalls: number;
  };
  error?: string;
};

/** One content block of a user message (Anthropic Messages shape). */
export type UserBlock =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: { type: "base64"; media_type: "image/png"; data: string };
    };

export type RunOptions = {
  dir: string;
  model: string;
  systemPrompt: string;
  message: string;
  tools: string[];
  /** Views allowed per run (0 = no vision tools). */
  visionBudget: number;
  /** Builds the review message once the first turn ends; null skips it. */
  review?: () => Promise<UserBlock[] | null>;
};

const countCalls = (dir: string) =>
  readFileSync(join(dir, "calls.jsonl"), "utf8").split("\n").filter(Boolean)
    .length;

export function runClaude(o: RunOptions): Promise<RunResult> {
  const mcpConfig = join(o.dir, "mcp.json");
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
            SPIKE_STATE: join(o.dir, "state.json"),
            SPIKE_LOG: join(o.dir, "calls.jsonl"),
            SPIKE_TOOLS: o.tools.join(","),
            SPIKE_VISION: String(o.visionBudget),
          },
        },
      },
    }),
  );
  const args = [
    "-p",
    "--model",
    o.model,
    "--system-prompt",
    o.systemPrompt,
    "--tools",
    "",
    "--strict-mcp-config",
    "--mcp-config",
    mcpConfig,
    "--setting-sources",
    "",
    "--allowedTools",
    o.tools.map((t) => `mcp__${SERVER}__${t}`).join(","),
    "--output-format",
    "stream-json",
    "--verbose",
    "--no-session-persistence",
    ...(o.review ? ["--input-format", "stream-json"] : []),
  ];
  const env = { ...process.env };
  delete env.CLAUDECODE; // a nested `claude -p` refuses to start otherwise
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn("claude", args, {
      cwd: o.dir,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    let firstCalls = -1;
    const send = (content: UserBlock[]) =>
      child.stdin.write(
        `${JSON.stringify({ type: "user", message: { role: "user", content } })}\n`,
      );
    let pending = "";
    child.stdout.on("data", (d) => {
      out += d;
      if (!o.review) return;
      // Watch for the first turn's result, then send the review (once).
      pending += d;
      let nl: number;
      while ((nl = pending.indexOf("\n")) !== -1) {
        const line = pending.slice(0, nl);
        pending = pending.slice(nl + 1);
        let type: unknown;
        try {
          type = (JSON.parse(line) as { type?: unknown }).type;
        } catch {
          continue;
        }
        if (type !== "result") continue;
        if (firstCalls !== -1) {
          child.stdin.end();
          continue;
        }
        firstCalls = countCalls(o.dir);
        o.review()
          .then((blocks) => (blocks ? send(blocks) : child.stdin.end()))
          .catch((e) => {
            err += `review failed: ${String(e)}\n`;
            child.stdin.end();
          });
      }
    });
    child.stderr.on("data", (d) => (err += d));
    const timer = setTimeout(() => child.kill("SIGTERM"), TIMEOUT_MS);
    if (o.review) send([{ type: "text", text: o.message }]);
    else child.stdin.end(o.message);
    child.on("close", (code) => {
      clearTimeout(timer);
      writeFileSync(join(o.dir, "transcript.jsonl"), out);
      if (err) writeFileSync(join(o.dir, "stderr.txt"), err);
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
      const results = events.filter((e) => e.type === "result");
      const result = results[results.length - 1];
      const num = (v: unknown) => (typeof v === "number" ? v : null);
      // Each result's usage covers its own turn; cost and API time are cumulative.
      const usage: Record<string, number> = {};
      for (const r of results)
        for (const [k, v] of Object.entries(
          (r.usage as Record<string, unknown>) ?? {},
        ))
          if (typeof v === "number") usage[k] = (usage[k] ?? 0) + v;
      const firstCost = num(results[0]?.total_cost_usd);
      const lastCost = num(result?.total_cost_usd);
      resolve({
        finalText: results
          .map((r) => String(r.result ?? ""))
          .join("\n\n— after the review —\n\n"),
        costUsd: lastCost,
        usage,
        turns: num(result?.num_turns),
        durationMs: Date.now() - started,
        apiMs: num(result?.duration_api_ms),
        toolUses,
        ...(o.review && results.length > 1
          ? {
              review: {
                firstCostUsd: firstCost,
                reviewCostUsd:
                  firstCost !== null && lastCost !== null
                    ? lastCost - firstCost
                    : null,
                firstCalls,
              },
            }
          : {}),
        error:
          code === 0 && result && !result.is_error
            ? undefined
            : `exit ${code}${result?.is_error ? ` · ${String(result.subtype)}` : ""}${err ? ` · ${err.slice(0, 300)}` : ""}`,
      });
    });
  });
}
