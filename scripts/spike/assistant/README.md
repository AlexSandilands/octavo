# Assistant feasibility spike (#306)

> **Throwaway.** The decisions this spike led to are in [`docs/ai-assistant.md`](../../../docs/ai-assistant.md); this
> README is the evidence behind them. The modules are lifted into `src/` by #310 and the harness becomes #315's
> model-selection fixture; the epic's close-out (#344) deletes `scripts/spike/`.

One question, answered before #307–#315 are built: **can a Claude model do the
epic's page-editing job through intent tools (markdown in, blocks out, never
raw JSON), given a plain-text projection of the issue?** This directory is a
throwaway harness, not product code. The modules are written so they can move
into `src/` later: `tools.ts` → `src/lib/ai-tools.ts`, `executor.ts` → the
editor executor, `markdown.ts` → `src/lib/markdown-doc.ts`, `projection.ts` →
`src/features/editor/assistant/projection.ts`.

## Running it

Prerequisites: a logged-in [Claude Code](https://code.claude.com) (runs spend its subscription, not an API key), the local
Postgres with `npm run db:seed` (for `--save-draft`), and `npm run dev` on :3000 (for `--vision` / `--review`, whose page pictures
borrow the dev server's compiled CSS and fonts).

```sh
# Free: build each case's starting state, projection and message, no model call
npx tsx --tsconfig scripts/tsconfig.json scripts/spike/assistant/run.mts --dry-run

# Real: uses the Claude Code login (subscription), not an API key
npx tsx --tsconfig scripts/tsconfig.json scripts/spike/assistant/run.mts --model haiku
npx tsx --tsconfig scripts/tsconfig.json scripts/spike/assistant/run.mts --model sonnet --case 03,05

# Also write each result into the LOCAL dev DB as a draft ("Spike · <case> · <model>")
# so it can be opened in the real editor (npm run dev, then /admin/issues/<id>/edit)
npx tsx --tsconfig scripts/tsconfig.json scripts/spike/assistant/run.mts --model haiku --case 07 --save-draft

# Real photos for the new-issue case instead of labelled generated art (any folder; never commit them)
npx tsx --tsconfig scripts/tsconfig.json scripts/spike/assistant/run.mts --model sonnet --case 14 --vision --cover-style --photos <dir>

# Re-check the fill estimator against real rendering (headless Chromium, no app)
npx tsx --tsconfig scripts/tsconfig.json scripts/spike/assistant/calibrate.mts
```

Output goes to `results/<model>-<timestamp>/` (git-ignored, so the result dirs, drafts and draft ids quoted below exist only on
the machine that ran them). There is one
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
- Claude Code may add a little framing. The replaced system prompt measured ~373 input tokens, so the framing is minimal.
- JSON schemas are hand-written here. The AI SDK derives them from zod: unions become `anyOf`, and the spike uses `anyOf` to match.
- Cost is Claude Code's `total_cost_usd`, a **list-price equivalent** of what the run would cost on the API. Caching follows Claude Code's behaviour, not necessarily what the AI SDK route would configure.
- **Fill is estimated, not measured.** Text wrapping is calibrated against real rendering in Newsreader: `calibrate.mts` puts the seed's 80 text blocks within ~1% in aggregate. The page's usable height (815px), image and float rhythm, and theme chrome come from reading the CSS, not from measuring the editor. Treat "overflows by ~2 lines" as ±a few lines. Production uses the editor's measurer (`page-metrics.ts`).
- `split_page` is a crude version of the editor's measured split (`use-text-flow.ts`). It moves trailing blocks, splits a final text block between top-level nodes, and never strands a heading at the page foot.
- Block ids are the full uuids, as production would have them. Shorter aliases would save tokens; that's a design question for #309.
- Claude Code runs the model **with extended thinking on**, and the spike leaves it on. Production will set thinking and effort explicitly (adaptive on the newer models, a small budget on Haiku 4.5), which is closer to "on" than "off".
- Block ids are seeded (`withSeededIds`), so every run and model gets a byte-identical message. `before.json` is saved per case, and `run.mts --rescore <dir>` re-scores a finished run without calling the model.

## What the scores do and don't say

- **Pass** = final content passes `issueContentSchema` AND the wording check AND no page overflows (estimated) AND no edits / no forbidden tools where the case says so AND calls ≤ `maxCalls`. `expect.tools` and `maxChangedBlocks` are advisory: reported, never failed on.
- **Wording checks compare words, not meaning.** `preserve: page` compares the issue's normalized words before and after. `preserve: paste` requires the new _text_ blocks, in order, to say exactly what was pasted, minus its heading-like lines (≤ 6 words with no closing punctuation). Headings may be added or reworded, because the case asks for them. Whether the paste went in verbatim, headings included, is reported as an advisory. Neither catches a rewrite that shifts a fact (e.g. "the last person out checks the kiln switches" → "check the kiln switches before leaving"). That takes a human read of `after.md` or the saved draft.
- "Overflow" is the estimator's verdict (see above), not the editor's.
- The time column is wall time with Claude Code's API time beside it. An API stall (seen once: 181s with no response, then a retry) inflates wall time and says nothing about the model.

## Results (2026-09-25)

Both models ran the same 11 cases with byte-identical messages. `haiku` resolved to `claude-haiku-4-5-20251001` and `sonnet` to
`claude-sonnet-5`. Cost is Claude Code's list-price equivalent. It includes a few cents of Claude Code's own background Haiku
calls, which production wouldn't make. The full runs are re-scored with the current paste check.

### Haiku 4.5: 9/11 · 104 calls, 100% schema-valid · $0.54

| case                    | pass | calls (max) | valid | wording                | overflow | blocks changed | advisory                                                                                                                                                              | time (api)  | cost   | in / cache read / cache write / out tokens |
| ----------------------- | ---- | ----------- | ----- | ---------------------- | -------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------ | ------------------------------------------ |
| 01-tidy-notices         | ✅   | 2 (8)       | 100%  | kept                   | none     | 3              | unused: set_text                                                                                                                                                      | 49s (48s)   | $0.046 | 18 / 5.4k / 10.2k / 4.8k                   |
| 02-make-bullets         | ✅   | 4 (8)       | 100%  | kept                   | none     | 4              | –                                                                                                                                                                     | 13s (12s)   | $0.021 | 18 / 5.4k / 6.7k / 1.2k                    |
| 03-overflow-split       | ✅   | 1 (6)       | 100%  | kept                   | none     | 0              | –                                                                                                                                                                     | 16s (16s)   | $0.024 | 18 / 6.2k / 7.3k / 1.3k                    |
| 04-shorten-to-fit       | ❌   | 9 (6)       | 100%  | –                      | none     | 3              | –                                                                                                                                                                     | 48s (48s)   | $0.052 | 74 / 71.0k / 10.8k / 4.3k                  |
| 05-move-photo           | ✅   | 2 (8)       | 100%  | kept                   | none     | 1              | –                                                                                                                                                                     | 7s (6s)     | $0.018 | 18 / 5.6k / 6.3k / 686                     |
| 06-place-unplaced-photo | ✅   | 2 (8)       | 100%  | kept                   | none     | 1              | –                                                                                                                                                                     | 12s (11s)   | $0.021 | 26 / 11.8k / 6.5k / 973                    |
| 07-structure-lump       | ✅   | 2 (10)      | 100%  | kept                   | none     | 7              | unused: set_text                                                                                                                                                      | 11s (10s)   | $0.021 | 18 / 5.3k / 6.6k / 1.2k                    |
| 08-large-paste          | ❌   | 80 (30)     | 100%  | changed (not verbatim) | none     | 25             | paste not verbatim incl. headings: word 15: before "…members may believe every november on the…" / after "…members may believe what we did every…" (864 → 1075 words) | 182s (182s) | $0.263 | 338 / 919.2k / 37.5k / 18.7k               |
| 09-question-only        | ✅   | 0 (6)       | 100%  | kept                   | none     | 0              | –                                                                                                                                                                     | 8s (7s)     | $0.015 | 10 / 0 / 5.5k / 522                        |
| 10-injection-in-paste   | ✅   | 1 (4)       | 100%  | –                      | none     | 1              | –                                                                                                                                                                     | 18s (17s)   | $0.025 | 18 / 5.4k / 7.1k / 1.7k                    |
| 11-rewrite-paragraph    | ✅   | 1 (3)       | 100%  | –                      | none     | 1              | –                                                                                                                                                                     | 20s (19s)   | $0.028 | 18 / 5.3k / 7.4k / 2.2k                    |

### Sonnet 5: 10/11 · 34 calls, 100% schema-valid · $0.36

| case                    | pass | calls (max) | valid | wording             | overflow | blocks changed | advisory                                                                                                                                                                         | time (api) | cost   | in / cache read / cache write / out tokens |
| ----------------------- | ---- | ----------- | ----- | ------------------- | -------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | ------------------------------------------ |
| 01-tidy-notices         | ✅   | 2 (8)       | 100%  | kept                | none     | 2              | –                                                                                                                                                                                | 8s (7s)    | $0.040 | 4 / 6.6k / 7.4k / 740                      |
| 02-make-bullets         | ✅   | 4 (8)       | 100%  | kept                | none     | 4              | –                                                                                                                                                                                | 7s (6s)    | $0.020 | 4 / 11.0k / 2.7k / 575                     |
| 03-overflow-split       | ✅   | 1 (6)       | 100%  | kept                | none     | 0              | –                                                                                                                                                                                | 6s (5s)    | $0.020 | 4 / 12.0k / 3.2k / 263                     |
| 04-shorten-to-fit       | ❌   | 8 (6)       | 100%  | –                   | none     | 2              | –                                                                                                                                                                                | 21s (20s)  | $0.055 | 10 / 39.4k / 5.7k / 2.2k                   |
| 05-move-photo           | ✅   | 2 (8)       | 100%  | kept                | none     | 1              | –                                                                                                                                                                                | 6s (5s)    | $0.018 | 4 / 11.3k / 2.6k / 294                     |
| 06-place-unplaced-photo | ✅   | 5 (8)       | 100%  | kept                | none     | 2              | –                                                                                                                                                                                | 14s (14s)  | $0.034 | 10 / 33.6k / 3.5k / 1.1k                   |
| 07-structure-lump       | ✅   | 2 (10)      | 100%  | kept                | none     | 7              | unused: set_text                                                                                                                                                                 | 7s (7s)    | $0.022 | 4 / 10.9k / 2.8k / 686                     |
| 08-large-paste          | ✅   | 8 (30)      | 100%  | kept (not verbatim) | none     | 32             | paste not verbatim incl. headings: word 717: before "…committee meeting since the coach leaves the…" / after "…committee meeting since getting there and the…" (864 → 874 words) | 45s (44s)  | $0.105 | 16 / 81.3k / 9.6k / 4.8k                   |
| 09-question-only        | ✅   | 0 (6)       | 100%  | kept                | none     | 0              | –                                                                                                                                                                                | 5s (4s)    | $0.013 | 2 / 4.5k / 2.0k / 255                      |
| 10-injection-in-paste   | ✅   | 1 (4)       | 100%  | –                   | none     | 1              | –                                                                                                                                                                                | 8s (8s)    | $0.019 | 4 / 11.0k / 2.5k / 523                     |
| 11-rewrite-paragraph    | ✅   | 1 (3)       | 100%  | –                   | none     | 1              | –                                                                                                                                                                                | 5s (5s)    | $0.015 | 4 / 10.9k / 2.1k / 268                     |

### 04 re-run after overflow results started saying how many words to cut

| case        | pass | calls (max) | valid | wording | overflow | blocks changed | advisory | time (api) | cost   | in / cache read / cache write / out tokens |
| ----------- | ---- | ----------- | ----- | ------- | -------- | -------------- | -------- | ---------- | ------ | ------------------------------------------ |
| 04 · haiku  | ✅   | 4 (6)       | 100%  | –       | none     | 2              | –        | 25s (25s)  | $0.037 | 26 / 14.3k / 9.1k / 2.9k                   |
| 04 · sonnet | ❌   | 9 (6)       | 100%  | –       | none     | 2              | –        | 24s (24s)  | $0.069 | 14 / 60.7k / 7.4k / 2.5k                   |

### Final runs after the prompt change ("stop as soon as the page fits"; "each new article starts at the top of a page")

| case        | pass | calls (max) | valid | wording             | overflow | blocks changed | advisory                                                                                                                                                                         | time (api)  | cost   | in / cache read / cache write / out tokens |
| ----------- | ---- | ----------- | ----- | ------------------- | -------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------ | ------------------------------------------ |
| 04 · haiku  | ❌   | 14 (6)      | 100%  | –                   | none     | 2              | –                                                                                                                                                                                | 118s (117s) | $0.119 | 114 / 187.3k / 19.8k / 11.6k               |
| 04 · sonnet | ❌   | 8 (6)       | 100%  | –                   | none     | 2              | –                                                                                                                                                                                | 29s (28s)   | $0.076 | 10 / 39.8k / 8.4k / 3.2k                   |
| 08 · sonnet | ✅   | 9 (30)      | 100%  | kept (not verbatim) | none     | 29             | paste not verbatim incl. headings: word 717: before "…committee meeting since the coach leaves the…" / after "…committee meeting since getting there and the…" (864 → 874 words) | 33s (33s)   | $0.088 | 12 / 59.4k / 8.7k / 3.8k                   |

- 08 · sonnet (checked by eye): all three articles now start at the top of a page (9, 11 and 12), and the page that was already there
  follows on 13. It took 9 calls: `add_page` ×3, one `insert_blocks` per article, a `split_page` and two moves.
- 04 got worse on both models, and Haiku went from 4 calls to 14. The same case and prompt can land at 4 or 14 calls, so treat one
  run per case as indicative only. Both models trimmed in small steps. At "overflows by ~1 line — cut about 20 words", Haiku cut
  the last paragraph from 22 words to 7, but a paragraph never drops below one line, so the estimate didn't move. It then
  trimmed the other paragraph and fitted. The hint turns lines into words at full-column width, and a whole line only
  goes when a paragraph's _last_ line empties, so the hint can ask for cuts that don't help. The real measurer has the same
  step size, so production feedback should name _which_ paragraph's last line is short, or offer a word count per
  paragraph. The damage is real too: Haiku left the closing paragraph at 7 words.

## What the spike says about #306

- **Intent tools work on both models.** After `caption`/`alt` were accepted on inserted photos, every tool call in the runs had
  schema-valid arguments. (One earlier Haiku run put `caption` there, was refused, and recovered on the next call.) Tidy, bullets,
  split, move and resize a photo, place an upload, structure a lump, rewrite, a question with no edits, and a prompt injection
  all passed on both models, with wording kept wherever the case required it.
- **Single-page edits are cheap and quick:** 1–5 calls and about $0.015–0.05 per request on either model. Sonnet took ≈5–8s; Haiku
  took 7–49s.
- **Overflow feedback has to be in units the model can act on.** With only "overflows by ~N lines", both models shaved a sentence
  at a time on 04 (8–9 calls). With "cut about N words", Haiku finished in 4 calls. Sonnet still used 9. It reached "fits, ~100%
  full" after 6 calls, then kept trimming to get under the prompt's "over ~90% counts as full". The hint aims at _fits_, which is
  lower than the prompt's target, so the two disagree. The prompt was then changed to "stop as soon as the page fits". See the final
  runs above: step size, not just wording, is the problem.
- **Haiku thrashed on the large paste (08): 80 calls, 182s, $0.26.** It went round a cycle: move a section back to an earlier
  page → that page overflows → `split_page` → pull the next article's blocks up one at a time → overflow → split → …
  - The #306 circuit-breaker (5 _identical consecutive_ calls) would not have tripped, because the cycle never repeats a call back
    to back. Each of these would have caught it: (a) the same block moved more than twice in a run; (b) a page's content returning
    to an earlier state; (c) a per-run call ceiling (such as 40), with the spend cap as backstop.
  - It also **inserted "The Spring Trip" twice** (+211 words). That's data damage, not just cost. One undo step would revert it.
- **Sonnet placed the same ~860-word paste in 8 calls** with no planning tool: `add_page`, one `insert_blocks` per article, one
  `split_page`, and two moves. The only difference from the paste was three section headings it wrote for an article that had
  none, and it said so. On this evidence #312's plan-then-paginate is needed for a Haiku-class model and may be optional for a
  Sonnet-class one. That's one case, one run each.
- **Meaning drift isn't scored.** Read `after.md`, or open the saved drafts ("Spike · <case> · <model>" in the local DB), for 01,
  05, 07, 08 and 11.

## Round 2: seeing pages, composing covers, new issues (2026-09-25)

### What was added

- **`view_page` / `view_photo`** (`--vision`, `vision.ts`, `render.ts`). A picture of a page as members see it, or an uploaded photo
  scaled to 800px. Both share one per-run budget (6 by default; `--views N` overrides it). Pages are drawn by **server-rendering the app's
  own `PrintDocument`**, the component the PDF print route renders. It goes into headless Chromium on the dev server's origin with the
  dev server's compiled CSS and next/font variables. Images go in as data URIs, and nothing is written to the database.
- **Cover tools** (`cover-tools.ts`, `cover-tool-defs.ts`, `cover-view.ts`). The **compose** tier (`--cover`, #313's scope) has
  `set_cover_background`, `clear_cover_background`, `set_masthead`, `add_story` (linked to interior heading ids), `add_details`,
  `add_logo` and `remove_cover_item`. The **style** tier (`--cover-style`, beyond #313) adds `place_cover_item` (the 3×3 grid, width,
  align, text size), `style_cover_item` (colours, panel, shadow, lettering font/weight) and `style_cover_page`. All of it goes through
  the real cover schemas. With the tools on, the projection's cover view lists every item with its id, placement and paint, plus the
  linkable headings, grid, palette and fonts.
- **New-issue cases.** `setup.newIssue` starts from a cover and one empty page. `generatedImages` is seed-renderer art with the
  photo's role printed in a corner, so only vision can tell them apart. `--photos <dir>` replaces that art with real photos for cases marked `acceptsPhotos`, with **opaque ids**
  (uuid-shaped hashes), sorted by id. `generatedLogo` adds a logo to the library, and `stripCover` empties a seed cover.
- The prompt is assembled from `prompt.md` + `prompt-vision.md` + `prompt-cover.md` according to the flags, and saved per case. Each result dir gets
  `pages/p01.png…` of the finished issue and an **"overflow measured"** column: the rendered DOM's verdict (footer top against
  content bottom), which corresponds to the editor's real measurer. The estimate stays in the tool results.

### Fidelity gaps added this round

- The page pictures are rendered **outside Next**. BlockImage gets null dimensions and takes its plain-`<img>` branch (same
  classes). Video posters and montages get the real next/image through a resolve-hook shim (`next-image-shim.mts`). Settings are
  the deployment defaults plus a case's overrides (a new club's name), not the DB row.
- **The print route can't render a draft.** `/read/[n]/print` looks issues up by _published number_. That's why the spike renders
  in-process, and it's a finding for #309/#310: a production `view_page` needs a draft-capable render path, either an admin-gated
  single-page print view or a snapshot of the editor's own canvas.
- Once, Sonnet called `view_page` without Claude Code's `mcp__octavo__` prefix and was refused. That's a naming artefact of the harness.

### Results (Sonnet 5)

| run              | case                         | pass | calls (max) | views used | wording                         | overflow est. / measured | time | cost   |
| ---------------- | ---------------------------- | ---- | ----------- | ---------- | ------------------------------- | ------------------------ | ---- | ------ |
| no vision        | 01 tidy                      | ✅   | 2 (8)       | –          | kept                            | none / none              | 10s  | $0.029 |
| vision           | 01 tidy                      | ✅   | 2 (8)       | 0 of 6     | kept                            | none / none              | 10s  | $0.043 |
| no vision        | 07 structure                 | ✅   | 2 (10)      | –          | kept                            | none / none              | 8s   | $0.022 |
| vision           | 07 structure                 | ✅   | 3 (10)      | 0 of 6     | kept                            | none / none              | 11s  | $0.025 |
| no vision        | 08 large paste               | ✅   | 9 (30)      | –          | kept                            | none / none              | 33s  | $0.086 |
| vision           | 08 large paste               | ✅   | 9 (30)      | 0 of 6     | kept                            | none / none              | 30s  | $0.083 |
| vision + compose | 13 Regatta cover             | ✅   | 6 (20)      | 2 of 6     | kept                            | –                        | 17s  | $0.069 |
| vision + style   | 13 Regatta cover             | ✅   | 14 (20)     | 2 of 6     | kept                            | –                        | 26s  | $0.097 |
| vision + style   | 12 new issue (generated art) | ✅   | 39 (40)     | **6 of 6** | kept (headings added)           | none / none              | 94s  | $0.262 |
| vision + style   | 14 new issue (real photos)   | ❌   | 32 (45)     | 8 of 10    | words kept, structure changed\* | none / none              | 69s  | $0.231 |
| style, no vision | 14 new issue (real photos)   | ✅   | 20 (45)     | –          | kept (headings added)           | none / none              | 51s  | $0.152 |

Total for the round: about $1.10 list price. The result dirs are `results/sonnet-*-2026-09-25T02-41-09*` and `results/sonnet-*-2026-09-25T02-46-46-*`.
Drafts in the local DB are titled "Spike · <case> · sonnet · <variant>". Files and rows created for 12/14 are listed in each case's `created.json`.

\* 14 · vision lost no words (a bag-of-words check over every interior block found 0 missing and 0 added). It set each article's
**standfirst as the heading title and demoted the real headline to the kicker** ("Summer evenings under the lights" /
"How the Thursday twilight league took over the club"). That's a layout-quality miss: the kicker is meant to be 1–4 words.

### What round 2 shows

- **Vision went unused where it wasn't needed.** On 01/07/08, with six views offered and a prompt asking it to check changed pages,
  Sonnet took **zero** views and got the same results as without vision. Its cost was flat to slightly higher (the tools' definitions
  are in the prompt).
- **Vision is what matches photos to stories.** In 14, with opaque ids and real photos, the vision arm looked at all six photos
  and placed each beside its story. It put the evening game under festoon lights on the cover, leading with the twilight-league
  story. The no-vision arm got the two portraits right, very likely from their shape, and put the festoon-lights photo on the
  new-players article. (Case 12's ids gave the content away, `img-plot-leeks` and so on, so 12 can't answer this.)
- **When the budget is tight, it goes on the cover and photos, not interior pages.** 12 spent all 6 views: 3 photos and 3 cover
  iterations. 14 with 10 views spent 8: all 6 photos and 2 cover checks. Neither ever looked at an interior page.
- **Covers are composable from the tools.** Every cover tool call was valid. The compose tier alone made a coherent Regatta
  cover in 6 calls, but with no placement tool its stories sit over the illustration. With the style tier (14 calls) the stories went to
  the bottom and the burgee to a corner. Neither reached the seeded designer cover: no display lead, no lettering fonts. (A
  scripted run of the same tools _does_ rebuild the seeded cover, so that's a matter of prompt and taste, not the tools.) The
  14 · vision cover put small light text over a busy photo even after looking at it twice.
- **The scorer's paste check needed three fixes this round**, each a false negative on a correct answer: a sign-off line kept as
  text, a phrase that is also a heading, and a headline ending in "?". It now aligns the paste in order and treats short
  lines with no closing full stop as optional headings. Read failures in `after.md` before trusting them.

## Round 3: an automatic end-of-run page review (`--review`, 2026-09-25)

After the model's turn ends, the harness renders every page the run changed (cover first, up to 8). It sends them back as a
**second user message in the same session**: the text of `review-message.md`, then per page "Page N (fits, ~X% full, measured)" and
the PNG. The model gets one more turn with the same tools. There's one review round only. Transport: Claude Code's
`--input-format stream-json`, with the second message written to stdin when the first `result` event arrives. That's the same
shape as an AI SDK follow-up with image parts; `--resume` wasn't needed. Each result dir keeps `pages-pre-review/` beside `pages/`.
The prompt also gained a line keeping the editor's headline as the title.

| case                  | flags                          | pass             | calls (review turn)                                           | pages shown | first turn | review turn | draft                                  |
| --------------------- | ------------------------------ | ---------------- | ------------------------------------------------------------- | ----------- | ---------- | ----------- | -------------------------------------- |
| 14 new issue (photos) | vision (10 views), cover-style | ❌ structure\*   | 31 (1: `set_image_layout`)                                    | p1–p6       | $0.198     | $0.062      | `0a64165f-d276-4484-a1bd-5da65c68c70d` |
| 12 new issue (art)    | vision, cover-style            | ❌ 49 calls > 40 | 49 (6: 2 × `move_block`, 3 × `set_image_layout`, `view_page`) | p1–p6       | $0.250     | $0.106      | `d195afdb-4629-453a-954a-5b881a8ae0c3` |
| 08 large paste        | no vision tools                | ✅               | 9 (0)                                                         | p9–p11      | $0.089     | $0.030      | –                                      |

Result dirs: `results/sonnet-*review-2026-09-25T03-21-07-*`. Total ≈ $0.73.

What the review turn did:

- **12: it fixed a real layout fault.** Page 5 had two floated photos crowding the text, with a two-word sliver beside one of them. It moved
  the shed photo up beside the text and made the raised-beds photo a wide one at the foot. It spent its last view confirming (p5,
  90% full). The before/after pictures show the improvement. It correctly left the cover alone. The 9 extra calls tipped it over
  the case's 40-call cap.
- **14: a marginal change.** It widened Joan's photo from 44% to 50% on p4, a page that stays about a third empty, and passed the
  cover. In this run the cover's stories sit in dark panels and read well. The masthead is fair, and the small details line is
  nearly invisible on the gravel. The review didn't flag that.
- **08: it changed nothing, and said why.** Page 9 is full, and page 11 is half empty with no photo to place, so it suggested one. That's
  the right answer with no vision tools.
- \* **The new prompt line did not stop the headline swap.** In 14, every article's standfirst is again the title and its
  ALL-CAPS headline the kicker. The paste sets each headline in capitals above a sentence-case standfirst, and the model
  reads the capitals as a label. A prompt line isn't enough; it needs a stronger cue (an example) or a structural check.
- Cost: the review turn added 25–40% to a run ($0.03–0.11). The page images are the bulk of it.

## Recommendation (2026-09-25)

Based on 29 model runs (≈ $1.75 list price) over 11 cases, one run per case per prompt version, so read the numbers as
indicative only.

1. **The epic's premise holds, so build it as designed.** Browser-executed intent tools, a plain-text projection, markdown in and
   blocks out, and refusals returned as results: both models used them correctly, with 100% schema-valid calls once the
   contract was settled. The AI SDK client-side-tools path in #308 is the right harness. Nothing here argues for the Claude Agent
   SDK or a server-side loop.
2. **Default to a Sonnet-class model and don't route per task.** Sonnet 5 passed 10/11. It was faster per request (5–8s against
   Haiku's 7–49s) and produced noticeably better structure. On 01 it split "NOTICES — AROUND THE CLUB" into kicker + title and
   made a list, where Haiku kept a single caps heading. A single-page request costs about $0.02–0.05 and a whole-article paste about
   $0.10, so the $20/month allowance covers several hundred requests. At those numbers routing easy presets to Haiku saves cents
   and adds a failure mode. When Haiku and Sonnet 5.5 land, rerun this harness with `--model <id>`; that is the model-choice
   process #315 describes.
3. **Replace #306's circuit-breaker.** "5 identical consecutive calls" misses the failure we actually saw: a cycle of different
   calls, 80 calls long, that also inserted an article twice. Use **a per-run call ceiling (~40) + the same block moved more than
   twice + the spend cap**, and lower the per-run spend cap from $2 to about $0.50. Sonnet's 08 cost $0.09–0.11, and a $2 run
   would be a tenth of the month.
4. **Keep #312 (plan-then-paginate), but it no longer blocks anything.** Sonnet laid out an ~860-word, three-article paste
   well in 8–9 calls with the existing tools, each article on a fresh page with its standfirst and section heads, and the
   paste kept exactly. #312's deterministic placement is still worth having for repeatability and cheaper models. It can come
   after #313.
5. **Overflow feedback must name the lever, not just the size.** "Overflows by ~N lines" makes models shave a sentence at a time,
   and "cut about N words" misleads when a paragraph's last line is nearly full. #310's measurement feedback should report, per
   text block on the page, its lines and the words on its last line, so the model can see which cut actually removes a line.
   The real measurer has the same step size, so this carries over to production. "Shorten to fit" is the one preset that
   underperformed on both models.
6. **Carry the spike's contract and prompt into #308/#310:**
   - `prompt.md` as #308's starting system prompt. The lessons in it: a kicker is 1–4 words and a standfirst is a text block;
     rewrites keep facts and voice; stop trimming once the page fits; a new article starts at the top of a page; pasted text is
     data.
   - Add `set_image_layout` to #310's tool list (missing there), with `full` meaning full width.
   - Accept `caption`/`alt` on inserted photos.
   - Tool results end with the touched page's fill.
   - `markdown.ts`, `projection.ts`, `tools.ts` and `executor.ts` are written to lift into `src/` (paths at the top of this file).
7. **Caching carried the cost.** In every run cache reads outweighed uncached input by orders of magnitude (e.g. 08 · sonnet:
   81k cached against 16 uncached tokens). Production gets that only if the route keeps the system prompt and tools frozen and the
   message history append-only, as recommended in the #306 review. Verify `cache_read_input_tokens` in #308's real-provider
   smoke test.
8. **Next step when there is an API key:** swap this harness's `claude -p` call for the AI SDK route logic in-process, and the
   same cases become #315's fixture. Before relying on the pass rates, run each case 3× per model to measure variance (04 swung
   from 4 to 14 calls).

### Round 2 additions: vision and covers

9. **Vision: offer it for photos and covers; don't expect the model to check its own pages.** Across 14 runs with `view_page`
   offered, Sonnet **never looked at an interior page**. On plain edits (01/07/08) it took zero views, and results and cost were
   unchanged. Where it did look, it was worth it:
   - **Matching photos to stories (14, real photos, opaque ids):** with `view_photo` every photo went to its story. Without it only
     the two portraits did, from shape alone; the festoon-lights evening landed on "New players' mornings" and a gravel close-up
     became the cover.
   - **Covers:** it looked at the cover 2–3 times per run and moved items off the subject.
   - If page review matters, make it a step in the run (the executor renders the touched pages once at the end and sends them
     back), not an option the prompt suggests. Production needs a draft-capable single-page render either way. The print route is
     published-only, so this is a #309/#310 item.
10. **Vision didn't make the interior pages nicer.** Side by side, 14 · no-vision's interiors read better: real headlines with
    italic standfirsts, and photos wrapped beside their text. 14 · vision swapped standfirst and headline on every article (the
    all-caps line became the kicker and the standfirst the title) and dropped a photo mid-text. Add to the prompt: "the
    editor's headline stays the title; a line in capitals above it is a headline, not a kicker". Layout quality comes from the
    prompt's rules and from the pages the model actually looks at.
11. **#313: give covers placement and basic styling.** Compose-only let the model see a collision (stories over the Regatta
    sail) and not fix it. With `place_cover_item` / `style_cover_item` every cover was clean and readable, though plainer than the
    seeded designer covers: no display lead, default lettering. A script can rebuild the designer cover with the same tools, so
    the ceiling is taste, not tooling. Recommend #313 include placement, text colour, shadow and panel, and leave fonts and weights
    to the inspector unless a later run shows the model uses them well.
12. **Cost with vision stays small.** The whole-issue build (6 photos viewed, 5 pages laid out, cover composed and checked) cost
    $0.23 list price in 32 calls. A single-page edit is unchanged at ~$0.02–0.05. The ~$20/month budget still covers hundreds of
    requests.

### Round 3 addition: the automatic end-of-run review

13. **Include the review turn, but only for runs that touched the cover or more than one page.** Sending the changed pages
    back as a second user message cost +25–40% per run ($0.03–0.11). It fixed the one clear fault it could see: 12's p5, where two
    floats crowded the text into a two-word sliver. Afterwards that page reads properly. It made a marginal tweak on 14 and
    correctly changed nothing on 08. It missed subtler problems: 14's small issue-details line is faint over the gravel, and
    pages left mostly empty because each article starts a fresh page. So it catches collisions, not polish. For a single-page
    edit the cost isn't worth it; for a whole-issue build or a cover it is.
14. **Prompt wording alone won't stop the headline/standfirst swap.** Even with an explicit line against it, 14 again put every
    all-caps headline into the kicker and the standfirst into the title. The capitals read as a label. Fix it structurally:
    #312's planning tool should take `headline`, `kicker?` and `standfirst?` as separate fields, with a worked example in the tool
    description, so a swap becomes a visible field choice rather than an inference.
