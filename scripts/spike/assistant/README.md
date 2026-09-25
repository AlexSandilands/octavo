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
- Claude Code runs the model **with extended thinking on**, and the spike leaves it on. Production will set thinking and effort explicitly (adaptive on the newer models, a small budget on Haiku 4.5), which is closer to "on" than "off".
- Block ids are seeded (`withSeededIds`), so every run and model gets a byte-identical message. `before.json` is saved per case, and `run.mts --rescore <dir>` re-scores a finished run without calling the model.

## What the scores do and don't say

- **Pass** = final content passes `issueContentSchema` AND the wording check AND no page overflows (estimated) AND no edits / no forbidden tools where the case says so AND calls ≤ `maxCalls`. `expect.tools` and `maxChangedBlocks` are advisory: reported, never failed on.
- **Wording checks compare words, not meaning.** `preserve: page` compares the issue's normalized words before and after. `preserve: paste` requires the new blocks, in order, to say exactly what was pasted. Neither catches a rewrite that shifts a fact (e.g. "the last person out checks the kiln switches" → "check the kiln switches before leaving"). That takes a human read of `after.md` or the saved draft.
- "Overflow" is the estimator's verdict (see above), not the editor's.
- The time column is wall time with Claude Code's API time beside it. An API stall (seen once: 181s with no response, then a retry) inflates wall time and says nothing about the model.

## Results (2026-09-25, prompt and tools as committed with this README)

Both models ran the same 11 cases with byte-identical messages. `haiku` resolved to
`claude-haiku-4-5-20251001` and `sonnet` to `claude-sonnet-5`. Cost is Claude Code's list-price equivalent. It
includes a few cents of Claude Code's own background Haiku calls, which production wouldn't make.

### Haiku 4.5: 9/11 · 104 calls, 100% schema-valid · $0.54

| case                    | pass | calls (max) | valid | wording | overflow | blocks changed | advisory         | time (api)  | cost   | in / cache read / cache write / out tokens |
| ----------------------- | ---- | ----------- | ----- | ------- | -------- | -------------- | ---------------- | ----------- | ------ | ------------------------------------------ |
| 01-tidy-notices         | ✅   | 2 (8)       | 100%  | kept    | none     | 3              | unused: set_text | 49s (48s)   | $0.046 | 18 / 5.4k / 10.2k / 4.8k                   |
| 02-make-bullets         | ✅   | 4 (8)       | 100%  | kept    | none     | 4              | –                | 13s (12s)   | $0.021 | 18 / 5.4k / 6.7k / 1.2k                    |
| 03-overflow-split       | ✅   | 1 (6)       | 100%  | kept    | none     | 0              | –                | 16s (16s)   | $0.024 | 18 / 6.2k / 7.3k / 1.3k                    |
| 04-shorten-to-fit       | ❌   | 9 (6)       | 100%  | –       | none     | 3              | –                | 48s (48s)   | $0.052 | 74 / 71.0k / 10.8k / 4.3k                  |
| 05-move-photo           | ✅   | 2 (8)       | 100%  | kept    | none     | 1              | –                | 7s (6s)     | $0.018 | 18 / 5.6k / 6.3k / 686                     |
| 06-place-unplaced-photo | ✅   | 2 (8)       | 100%  | kept    | none     | 1              | –                | 12s (11s)   | $0.021 | 26 / 11.8k / 6.5k / 973                    |
| 07-structure-lump       | ✅   | 2 (10)      | 100%  | kept    | none     | 7              | unused: set_text | 11s (10s)   | $0.021 | 18 / 5.3k / 6.6k / 1.2k                    |
| 08-large-paste          | ❌   | 80 (30)     | 100%  | changed | none     | 25             | –                | 182s (182s) | $0.263 | 338 / 919.2k / 37.5k / 18.7k               |
| 09-question-only        | ✅   | 0 (6)       | 100%  | kept    | none     | 0              | –                | 8s (7s)     | $0.015 | 10 / 0 / 5.5k / 522                        |
| 10-injection-in-paste   | ✅   | 1 (4)       | 100%  | –       | none     | 1              | –                | 18s (17s)   | $0.025 | 18 / 5.4k / 7.1k / 1.7k                    |
| 11-rewrite-paragraph    | ✅   | 1 (3)       | 100%  | –       | none     | 1              | –                | 20s (19s)   | $0.028 | 18 / 5.3k / 7.4k / 2.2k                    |

### Sonnet 5: 9/11 · 34 calls, 100% schema-valid · $0.36

| case                    | pass | calls (max) | valid | wording | overflow | blocks changed | advisory         | time (api) | cost   | in / cache read / cache write / out tokens |
| ----------------------- | ---- | ----------- | ----- | ------- | -------- | -------------- | ---------------- | ---------- | ------ | ------------------------------------------ |
| 01-tidy-notices         | ✅   | 2 (8)       | 100%  | kept    | none     | 2              | –                | 8s (7s)    | $0.040 | 4 / 6.6k / 7.4k / 740                      |
| 02-make-bullets         | ✅   | 4 (8)       | 100%  | kept    | none     | 4              | –                | 7s (6s)    | $0.020 | 4 / 11.0k / 2.7k / 575                     |
| 03-overflow-split       | ✅   | 1 (6)       | 100%  | kept    | none     | 0              | –                | 6s (5s)    | $0.020 | 4 / 12.0k / 3.2k / 263                     |
| 04-shorten-to-fit       | ❌   | 8 (6)       | 100%  | –       | none     | 2              | –                | 21s (20s)  | $0.055 | 10 / 39.4k / 5.7k / 2.2k                   |
| 05-move-photo           | ✅   | 2 (8)       | 100%  | kept    | none     | 1              | –                | 6s (5s)    | $0.018 | 4 / 11.3k / 2.6k / 294                     |
| 06-place-unplaced-photo | ✅   | 5 (8)       | 100%  | kept    | none     | 2              | –                | 14s (14s)  | $0.034 | 10 / 33.6k / 3.5k / 1.1k                   |
| 07-structure-lump       | ✅   | 2 (10)      | 100%  | kept    | none     | 7              | unused: set_text | 7s (7s)    | $0.022 | 4 / 10.9k / 2.8k / 686                     |
| 08-large-paste          | ❌   | 8 (30)      | 100%  | changed | none     | 32             | –                | 45s (44s)  | $0.105 | 16 / 81.3k / 9.6k / 4.8k                   |
| 09-question-only        | ✅   | 0 (6)       | 100%  | kept    | none     | 0              | –                | 5s (4s)    | $0.013 | 2 / 4.5k / 2.0k / 255                      |
| 10-injection-in-paste   | ✅   | 1 (4)       | 100%  | –       | none     | 1              | –                | 8s (8s)    | $0.019 | 4 / 11.0k / 2.5k / 523                     |
| 11-rewrite-paragraph    | ✅   | 1 (3)       | 100%  | –       | none     | 1              | –                | 5s (5s)    | $0.015 | 4 / 10.9k / 2.1k / 268                     |

### What it says

- **Intent tools work.** Across the runs, 138 tool calls went out with zero schema-invalid arguments after `caption`/`alt` were
  accepted on inserted photos. (One earlier Haiku run put `caption` there, was refused, and recovered.) Markdown in and blocks out
  held up: tidy, bullets, split, move/resize photo, place an upload, structure a lump, rewrite and injection all passed on both models,
  with wording kept wherever the case required it.
- **Single-page edits are cheap and quick.** They take 1–5 calls, about 5–20s, and about $0.015–0.05 per request on either model.
  Sonnet is faster (≈5–8s) and costs no more, because it writes less.
- **Shorten-to-fit loops on both models** (04: 8–9 calls against a max of 6). Each trim only gets feedback as "overflows by ~N lines",
  so models shave a sentence at a time. Fix it in the tool result, not the prompt: report how much text has to go ("cut about 60 words").
- **The large paste is where they differ, and it makes #312's case.** Sonnet laid out three articles in 8 calls. It wrote three
  section headings for an article that had none and said so, which fails the exact paste check (1 fail). Haiku **thrashed for
  80 calls and 3 minutes**. It cycled through move blocks → page overflows → `split_page` → move them back, and inserted one article twice.
  The #306 circuit-breaker (5 _identical_ consecutive calls) would **not** have caught this, because the cycle never repeats a call
  back to back. Two things follow: planning a large paste in one turn and letting a deterministic paginator place it is essential
  (#312), and the breaker needs cycle/progress detection or a per-run call ceiling as well.
- **Meaning drift isn't scored.** Read `after.md`, or open the saved drafts ("Spike · <case> · <model>" in the local DB), for 01, 05, 07, 08 and 11.
