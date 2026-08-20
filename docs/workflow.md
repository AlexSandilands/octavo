# Workflow — how GitHub issues get judged, routed, and worked

The evergreen process for working this repo with Claude Code: how to triage an
issue, which model runs it, how the implementation loop goes, and which gates a
change must pass before it merges. The issue brief is the intent; the code is
the source of truth for the _how_.

(This replaces `docs/issue-pipeline.md`, which also tracked the original
build-out phases — that history lives in the closed milestones, issues #6–#16
and #33/#36/#40, and their PRs.)

## Issues are the unit of work

- One issue per task, with intent + acceptance criteria in the brief.
- **Papercuts get their own small issues too** — log each one as it's noticed,
  with just enough context to act on later (what/where, a screenshot or console
  line if that's the evidence). The earlier running grab-bag issue (#33) worked
  until items ballooned mid-batch; it's closed — don't revive the pattern.
- If an issue grows past its brief (design-heavy, risks core behaviour),
  **split the extra scope to a new issue rather than stretch the one in
  flight** — carry the design notes across (#33 → #46 is the pattern).

## Triage: route each issue to a model

Every agent-runnable issue carries exactly one label:

- **`model:fable`** — complex, UI-sensitive, or security-critical work; anything
  touching the reader/editor interaction surfaces, auth, or many files at once.
- **`model:opus`** — well-specified tasks that mirror patterns already in the
  codebase (a new admin CRUD page shaped like an existing one, a mechanical
  sweep, a contained bug fix with a clear reproduction).

Issues only a person can do (accounts, DNS, deploys) are labelled **`human`**.

## The loop, per issue

1. **One subagent per issue** (Claude Code Agent tool). For `model:opus` issues,
   pass the `model: "opus"` override; `model:fable` issues use the default.
2. **Sequential, not parallel** — a single shared working tree, no git
   worktrees. One issue at a time.
3. **Branch per issue**, cut from up-to-date `main`.
4. **The agent does NOT commit.** It implements, verifies, and reports back.
5. **The orchestrator reviews the full diff**, re-runs verification itself,
   fixes findings directly, commits, and opens the PR. Merge `main` into the
   branch first if `main` has moved.
6. **The user's browser pass** on the PR is a required gate for anything with a
   UI surface (see below), then the user merges.

**The `/orchestrate` variant** (`.claude/skills/orchestrate/`) runs this loop
for one or more issues at once and deliberately supersedes rules 2, 4 and 5:
implementors work in parallel in their own git worktrees, and commit, push and
open their own PRs, with the orchestrator doing the review pass (inline PR
comments, iterate to sign-off) instead of committing. Everything else here —
the gates table especially — applies unchanged.

## Why the review pass is load-bearing

Nearly every agent run during the build-out needed at least one orchestrator fix
before it was safe to merge — spoofable headers, race conditions, focus-stealing,
state clobbering (#6–#10 in the archive). Keep the pass; it is not ceremony.
The durable lessons:

- **Client→server transport bugs are invisible to server-side verification.**
  ProseMirror's null-prototype `attrs` silently broke server actions (#13); a
  client-only theme toggle and lazy-loaded images silently broke PDFs (#16).
  Only a real browser pass catches this class — that's why it's a gate, not a
  courtesy.
- **Verify end-to-end yourself when possible** instead of leaning on the user's
  pass: headless Chromium is installed (DB-minted session cookie + curl +
  `pdftoppm` verifies PDFs; screenshots + keyboard walkthroughs verify UI).
- **Mechanical claims deserve mechanical checks.** "Moved verbatim" was verified
  by scripting old-vs-new class-string equality (#40); "hex↔token equivalent"
  by scripting the conversion (#14). Cheap to write, ends the argument.
- **Keep unrelated formatting drift out of PRs.** Format the files the branch
  touches; leave `main`'s pre-existing drift alone (#16).

## Required gates, by change type

| If the change touches…                | Then…                                                                                                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anything with a UI surface            | The user's browser pass on the PR is required (and do a headless Chromium pass first)                                                                               |
| Palette tokens / brand CSS            | `npx tsx scripts/dev-contrast-gate.mts` — WCAG AA must hold for **every** brand (`docs/design-principles.md` §6)                                                    |
| Print-visible rendering (PDF path)    | Bump `RENDER_VERSION` in `src/app/api/issues/[number]/pdf/route.ts` **in the same commit** (it cache-busts stored PDFs)                                             |
| The content model (`CONTENT_VERSION`) | Update the seed to author the new shape, keep one deliberate legacy page (see `docs/database.md`)                                                                   |
| The members CSV parser                | `npx tsx scripts/check-parse-members-csv.mts` — the header/delimiter cases an admin's export throws at it (#94)                                                     |
| Any modal dialog                      | `npx tsx scripts/dev-dialog-a11y-gate.mts <base-url>` — role/name, Escape, the focus trap and focus restore, per dialog (#130)                                      |
| A block that can render a link        | `npx tsx --tsconfig scripts/tsconfig.json scripts/dev-thumb-anchor-gate.mts` — the thumbnail must emit no `<a>` (#166)                                              |
| The library shelf or `/archive`       | `npx tsx --tsconfig scripts/tsconfig.json scripts/dev-archive-gate.mts <base-url> <dev-log>` — the home cap, the archive's URL state, the sign-in round trip (#192) |
| An admin mutation flow / list refresh | `npx tsx --tsconfig scripts/tsconfig.json scripts/prod-action-refresh-gate.mts <base-url>` against a **production build** (`npm run build` + `next start`) (#198)   |
| New pages / inline scripts            | CSP is nonce-based in `src/proxy.ts` — pages must render dynamically; no new inline styles/scripts                                                                  |
| Every change                          | `npm run lint`, `npx tsc --noEmit`, `npm run typecheck:scripts`, prettier on touched files, and a production build (plain `npm run build`; see below)               |

## Briefing an agent

Hand each subagent:

- The **full issue text verbatim** (freshly fetched — bodies change).
- The **project non-negotiables** (see [CLAUDE.md](../CLAUDE.md) and
  [design-principles.md](design-principles.md)).
- **"Do NOT commit."**
- **"Restore dev DB state"** — `profile.alex@proton.me` (admin) +
  `member@example.com`, both subscribed.
- **"No docker CLI"** in this environment — test the DB directly; the container
  is usually already running.
- **"Send report via SendMessage to main before finishing"** — per-item status,
  file-by-file summary, verification results, deviations with reasons.

## Environment gotchas

- Use `pkill -f "next dev"` to stop the dev server — `kill %1` silently fails in
  this (fish) shell. Run it as a **standalone** command: inside a compound
  command the pattern matches your own shell's command line and kills it
  (exit 144).
- Wipe `.next` after switching branches. Never run two dev servers in one
  checkout. If `rm -rf .next` reports "Directory not empty", a dev server is
  still writing to it.
- A production build needs only the `NEXT_PUBLIC_*` branding vars — **no
  secrets, no dummies**; plain `npm run build` works. `next build` evaluates
  server modules, but `src/lib/env.ts` validates the runtime secrets
  (`DATABASE_URL`, `AUTH_SECRET`, `R2_*`, `EMAIL_*`) **lazily** on first access,
  and nothing on the build-eval import graph reads a runtime field at module top
  level, so the build never touches them (issue #67). The fail-fast guarantee
  still holds at runtime: a misconfigured production deploy throws loudly at boot
  (the instrumentation Sentry env read) and no later than the first
  `/api/health` hit, which forces the full runtime parse. **Don't reintroduce the
  build-time requirement:** reading a runtime env field at module top level (on
  the build-eval graph) makes `next build` demand that secret again — CI builds
  with no runtime secrets set precisely to catch that (the CI workflow is updated
  in this same PR).
- **`npx tsc --noEmit` does not see the gate scripts.** The root include is
  `**/*.ts`, which does not match `.mts`, so every `scripts/*.mts` file was
  invisible to the type-check until #174. They are their own tsc project now —
  `npm run typecheck:scripts` (`scripts/tsconfig.json`) — because they need
  `allowImportingTsExtensions` (several import `../src/lib/*.ts` by full path,
  which is how tsx resolves them), which the app config must not carry. (The
  other historical difference, `jsx: react-jsx`, stopped being one when Next 16
  set the app config to the same value.) Run both checks; CI does.
- Never _install_ Playwright browsers — Chromium is already installed locally,
  and _using_ it for headless verification is fine.
- The seed **wipes all issues** (it refuses when published issues exist unless
  `--force`) — don't run it against a dev DB holding real authored content;
  validate seed changes in-memory via `buildIssues` instead.

## Architecture facts that keep biting

- Content is **v3** (Tiptap JSON body text). The v1/v2 string fallback is
  permanent; `npm run db:migrate-content` exists for any DB that ever held
  pre-v3 strings.
- The readers lazy-load per viewport via `ReaderMount` (used by `/read` and the
  admin preview).
- Layout themes live in `src/features/blocks/themes/` behind a registry; the
  brand palette is env-selectable (`NEXT_PUBLIC_BRAND`). Adding either is a
  module/CSS-block + registry entry — no conditional edits.
- **Admin list refreshes once wedged in production builds** (#198): the React
  canary Next 15.5 vendored had a lost-wakeup race that intermittently left
  the re-render after a server action's revalidation suspended forever under
  `next start` — fixed upstream and vendored from Next 16.2, which the app now
  runs (#201, which also removed the temporary `nudgeActionCommit()` rescuer).
  The production gate above stays as the permanent regression detector: run it
  for any admin mutation flow, always against a production build — the bug
  class is invisible under `next dev`.
