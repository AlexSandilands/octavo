// A stdio MCP server exposing the spike's tools to `claude -p` — the stand-in
// for the AI SDK's client-executed tools. Hand-rolled JSON-RPC (initialize,
// tools/list, tools/call; newline-delimited). State is a JSON file: load, apply
// the call, write back. Every call is appended to a JSONL log.
//   SPIKE_STATE=<state.json> SPIKE_LOG=<calls.jsonl> tsx mcp-server.mts
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { executeTool } from "./executor.ts";
import { fromStateFile, toStateFile, type StateFile } from "./seed.ts";
import { toolDefinitions } from "./tools.ts";

const statePath = process.env.SPIKE_STATE;
const logPath = process.env.SPIKE_LOG;
if (!statePath || !logPath)
  throw new Error("SPIKE_STATE and SPIKE_LOG must be set");

type Request = {
  jsonrpc: "2.0";
  id?: number | string;
  method: string;
  params?: Record<string, unknown>;
};

const send = (msg: object) =>
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", ...msg })}\n`);

function call(name: string, args: unknown) {
  const ctx = fromStateFile(
    JSON.parse(readFileSync(statePath!, "utf8")) as StateFile,
  );
  const started = Date.now();
  const result = executeTool(ctx, name, args);
  if (result.mutated)
    writeFileSync(statePath!, JSON.stringify(toStateFile(ctx)));
  appendFileSync(
    logPath!,
    `${JSON.stringify({ at: new Date().toISOString(), ms: Date.now() - started, name, args, valid: result.ok, mutated: result.mutated, result: result.text })}\n`,
  );
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
      return { tools: toolDefinitions };
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

createInterface({ input: process.stdin }).on("line", (line) => {
  if (!line.trim()) return;
  let req: Request;
  try {
    req = JSON.parse(line) as Request;
  } catch {
    return send({ id: null, error: { code: -32700, message: "parse error" } });
  }
  if (req.id === undefined) return; // a notification
  const result = handle(req);
  if (result === undefined)
    send({
      id: req.id,
      error: { code: -32601, message: `unknown method ${req.method}` },
    });
  else send({ id: req.id, result });
});
