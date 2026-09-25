// A stdio MCP server exposing the spike's tools to `claude -p` — the stand-in
// for the AI SDK's client-executed tools. Hand-rolled JSON-RPC (initialize,
// tools/list, tools/call; newline-delimited). State is a JSON file: load, apply
// the call, write back. Every call is appended to a JSONL log.
//   SPIKE_STATE=<state.json> SPIKE_LOG=<calls.jsonl> [SPIKE_TOOLS=a,b,…]
//   [SPIKE_VISION=<views>] [SPIKE_SETTINGS=<json>] tsx mcp-server.mts
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { executeTool } from "./executor.ts";
import { fromStateFile, toStateFile, type StateFile } from "./seed.ts";
import { coverToolDefinitions } from "./cover-tool-defs.ts";
import { toolDefinitions } from "./tools.ts";
import {
  Vision,
  VISION_TOOLS,
  visionDefinitions,
  type VisionTool,
} from "./vision.ts";

const statePath = process.env.SPIKE_STATE;
const logPath = process.env.SPIKE_LOG;
if (!statePath || !logPath)
  throw new Error("SPIKE_STATE and SPIKE_LOG must be set");

const visionBudget = Number(process.env.SPIKE_VISION ?? 0);
const vision = visionBudget
  ? new Vision(visionBudget, JSON.parse(process.env.SPIKE_SETTINGS ?? "{}"))
  : null;
const offered = process.env.SPIKE_TOOLS?.split(",");
const definitions = [
  ...[...toolDefinitions, ...coverToolDefinitions].filter(
    (t) => !offered || offered.includes(t.name),
  ),
  ...(vision ? visionDefinitions(visionBudget) : []),
];

type Request = {
  jsonrpc: "2.0";
  id?: number | string;
  method: string;
  params?: Record<string, unknown>;
};

const send = (msg: object) =>
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", ...msg })}\n`);

function log(entry: object) {
  appendFileSync(
    logPath!,
    `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`,
  );
}

async function call(name: string, args: unknown) {
  const ctx = fromStateFile(
    JSON.parse(readFileSync(statePath!, "utf8")) as StateFile,
  );
  const started = Date.now();
  if (vision && VISION_TOOLS.includes(name as VisionTool)) {
    const r = await vision.run(ctx, name as VisionTool, args);
    log({
      ms: Date.now() - started,
      name,
      args,
      valid: r.ok,
      mutated: false,
      image: r.ok,
      result: r.logText,
    });
    return { content: r.content, isError: !r.ok };
  }
  if (!definitions.some((t) => t.name === name)) {
    const text = `Error: there is no tool "${name}".`;
    log({ ms: 0, name, args, valid: false, mutated: false, result: text });
    return { content: [{ type: "text", text }], isError: true };
  }
  const result = executeTool(ctx, name, args);
  if (result.mutated)
    writeFileSync(statePath!, JSON.stringify(toStateFile(ctx)));
  log({
    ms: Date.now() - started,
    name,
    args,
    valid: result.ok,
    mutated: result.mutated,
    result: result.text,
  });
  return {
    content: [{ type: "text", text: result.text }],
    isError: !result.ok,
  };
}

function handle(req: Request) {
  switch (req.method) {
    case "initialize":
      return {
        protocolVersion:
          (req.params?.protocolVersion as string) ?? "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "octavo-spike", version: "0.0.1" },
      };
    case "tools/list":
      return { tools: definitions };
    case "tools/call": {
      const p = req.params as { name: string; arguments?: unknown };
      return call(p.name, p.arguments ?? {});
    }
    case "ping":
      return {};
    default:
      return undefined;
  }
}

// Calls run one at a time, in order: each loads, edits and saves the state file.
let queue: Promise<void> = Promise.resolve();

const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  if (!line.trim()) return;
  let req: Request;
  try {
    req = JSON.parse(line) as Request;
  } catch {
    return send({ id: null, error: { code: -32700, message: "parse error" } });
  }
  if (req.id === undefined) return; // a notification
  queue = queue.then(async () => {
    const result = await handle(req);
    if (result === undefined)
      send({
        id: req.id,
        error: { code: -32601, message: `unknown method ${req.method}` },
      });
    else send({ id: req.id, result });
  });
});
rl.on("close", () => void queue.then(() => vision?.close()));
