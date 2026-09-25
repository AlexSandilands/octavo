// One headless Claude Code run: our system prompt instead of Claude Code's,
// every built-in tool removed, the spike's tools served by mcp-server.mts,
// the projection + instruction on stdin. Captures the stream-json transcript.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
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
  error?: string;
};

export type RunOptions = {
  dir: string;
  model: string;
  systemPrompt: string;
  message: string;
  tools: string[];
  /** Views allowed per run (0 = no vision tools). */
  visionBudget: number;
};

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
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    const timer = setTimeout(() => child.kill("SIGTERM"), TIMEOUT_MS);
    child.stdin.end(o.message);
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
      const result = events.find((e) => e.type === "result");
      const num = (v: unknown) => (typeof v === "number" ? v : null);
      resolve({
        finalText: String(result?.result ?? ""),
        costUsd: num(result?.total_cost_usd),
        usage: (result?.usage as Record<string, number>) ?? {},
        turns: num(result?.num_turns),
        durationMs: Date.now() - started,
        apiMs: num(result?.duration_api_ms),
        toolUses,
        error:
          code === 0 && result && !result.is_error
            ? undefined
            : `exit ${code}${result?.is_error ? ` · ${String(result.subtype)}` : ""}${err ? ` · ${err.slice(0, 300)}` : ""}`,
      });
    });
  });
}
