# Assistant feasibility spike (#306)

One question, answered before #307–#315 are built: **can a Claude model do the
epic's page-editing job through intent tools (markdown in, blocks out, never
raw JSON), given a plain-text projection of the issue?** This directory is a
throwaway harness, not product code. The modules are written so they can move
into `src/` later: `tools.ts` → `src/lib/ai-tools.ts`, `executor.ts` → the
editor executor, `markdown.ts` → `src/lib/markdown-doc.ts`, `projection.ts` →
`src/features/editor/assistant/projection.ts`.

## Running it

```sh
# Free: build each case's starting state, projection and message, no model call
npx tsx --tsconfig scripts/tsconfig.json scripts/spike/assistant/run.mts --dry-run

# Real: uses the Claude Code login (subscription), not an API key
npx tsx --tsconfig scripts/tsconfig.json scripts/spike/assistant/run.mts --model haiku
npx tsx --tsconfig scripts/tsconfig.json scripts/spike/assistant/run.mts --model sonnet --case 03,05

# Also write each result into the LOCAL dev DB as a draft ("Spike · <case> · <model>")
# so it can be opened in the real editor (npm run dev, then /admin/issues/<id>/edit)
npx tsx --tsconfig scripts/tsconfig.json scripts/spike/assistant/run.mts --model haiku --case 07 --save-draft

# Re-check the fill estimator against real rendering (headless Chromium, no app)
npx tsx --tsconfig scripts/tsconfig.json scripts/spike/assistant/calibrate.mts
```

Output goes to `results/<model>-<timestamp>/` (git-ignored). There is one
folder per case with `message.txt` (exactly what the model was sent),
`transcript.jsonl` (the full stream-json, including every tool_use and
tool_result), `calls.jsonl` (each call as the tool server saw it: args, valid,
result), `before.md` / `after.md` (every page in full) and `score.json`. The
folder also holds `summary.md`, the table.

`--save-draft` needs `npm run db:seed` to have run: seed image ids are mapped to
its rows. It refuses any database that isn't on localhost.

## Files

| file                   | what it is                                                                                                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `prompt.md`            | the system prompt (#308's list)                                                                                                                                                                                    |
| `cases/*.json`         | 11 cases on the seed issues: instruction, optional setup/paste, expectation                                                                                                                                        |
| `tools.ts`             | the tool contract: zod schemas, plus the JSON schemas and descriptions the model sees                                                                                                                              |
| `executor.ts`          | runs one call against `IssueContent`: validate → apply → re-validate with `issueContentSchema`, rolling back on failure. Refusals come back as results the model reads, never as throws. Covers are refused (#313) |
| `markdown.ts`          | `markdownToDoc` / `docToMarkdown`. Lenient, never throws, and validated by `richDocSchema`. Round-trips all 86 seed text blocks exactly                                                                            |
| `fill.ts`              | **estimated** page fill (see below)                                                                                                                                                                                |
| `projection.ts`        | the text the model reads: header, outline with fill, the current page in full                                                                                                                                      |
| `mcp-server.mts`       | a stdio MCP server exposing the tools (hand-rolled JSON-RPC, no new deps). State is a JSON file, and every call is logged                                                                                          |
| `run.mts` / `score.ts` | runner and scorer                                                                                                                                                                                                  |
| `cases.ts` / `seed.ts` | case loading and setup; the seed issues built without a DB (`buildIssues` with `img-<key>` ids)                                                                                                                    |
| `save-draft.ts`        | `--save-draft`                                                                                                                                                                                                     |
| `calibrate.mts`        | the estimator's calibration                                                                                                                                                                                        |

## Fidelity to the production path

Production (#308/#310): Vercel AI SDK route → model, with client-executed tools
run by the editor. The spike instead runs **Claude Code headless on the
subscription**:

| production                          | spike                                                                                                                  |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| AI SDK `system`                     | `--system-prompt` (replaces Claude Code's prompt entirely)                                                             |
| client-side tools declared from zod | stdio MCP server; `--tools ""` removes every built-in tool; `--strict-mcp-config --setting-sources ""` isolates config |
| route's per-request projection      | sent in the user message (`message.txt`)                                                                               |
| `AI_MODEL`                          | `--model haiku` / `--model sonnet` (or a full model id)                                                                |
| editor re-measures after each edit  | `fill.ts` estimates after each edit                                                                                    |
| one run = one undo step             | not modelled (the state file is the run)                                                                               |

Known gaps:

- Tools arrive named `mcp__octavo__<tool>`, not `<tool>`.
- Claude Code may add a little framing. octavo-2c measured the replaced system prompt at ~373 input tokens, so the framing is minimal.
- JSON schemas are hand-written here. The AI SDK derives them from zod: unions become `anyOf`, and the spike uses `anyOf` to match.
- Cost is Claude Code's `total_cost_usd`, a **list-price equivalent** of what the run would cost on the API. Caching follows Claude Code's behaviour, not necessarily what the AI SDK route would configure.
- **Fill is estimated, not measured.** Text wrapping is calibrated against real rendering in Newsreader: `calibrate.mts` puts the seed's 80 text blocks within ~1% in aggregate. The page's usable height (815px), image and float rhythm, and theme chrome come from reading the CSS, not from measuring the editor. Treat "overflows by ~2 lines" as ±a few lines. Production uses the editor's measurer (`page-metrics.ts`).
- `split_page` is a crude version of the editor's measured split (`use-text-flow.ts`). It moves trailing blocks, splits a final text block between top-level nodes, and never strands a heading at the page foot.
- Block ids are the full uuids, as production would have them. Shorter aliases would save tokens; that's a design question for #309.

## Results

_Filled in after the runs._
