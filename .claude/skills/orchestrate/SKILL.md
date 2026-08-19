---
name: orchestrate
description: >
  Drive one or more GitHub issues to reviewed, orchestrator-signed-off PRs via
  parallel implementor subagents, each in its own git worktree — then (for 2+
  issues) stack the branches in an integration worktree and hand the user a running
  dev server to test the combined result. Use this whenever the user invokes
  /orchestrate with issue numbers, or asks to "work issues X and Y in
  parallel", "spawn implementors for these issues", "drive these issues to
  PRs", or names several issues and wants them implemented and reviewed in one
  run — even if they don't say "orchestrate".
---

# Orchestrate: issues → reviewed PRs → combined test server

You are the **orchestrator**. Implementor subagents write the code, commit,
push and open their own PRs; you verify everything they claim, review every
diff, and give or withhold sign-off. The user merges (unless they explicitly ask
you to). This skill deliberately supersedes two rules in `docs/workflow.md`:
implementors work **in parallel in their own worktrees** (not sequentially in
the shared tree) and **commit/push/open their own PRs** (you do not commit
their work). Everything else in that doc stands — especially the gates table
and the review pass.

**Arguments**: issue numbers, separated by spaces or commas (`/orchestrate 102, 103`).
An optional trailing `all-opus` (or `all-fable`) overrides the per-issue
`model:*` label routing for this run.

## Phase 0 — Preflight (verify, don't assume)

1. Read `docs/workflow.md`, `docs/design-principles.md` and CLAUDE.md if not
   already in context this session. The gates table in workflow.md is the
   contract the review pass enforces.
2. `git fetch` in the main checkout; confirm it's on `main`, clean, and
   current with origin. Surface anything unexpected instead of "fixing" it.
3. Fetch each issue **fresh** with `gh issue view <n>` — bodies change. Note
   its `model:*` label (routing) and whether an open PR already exists for it
   (if so, report and skip rather than duplicating).
4. Check the dev ports you'll assign are free (`ss -ltn`) and hunt orphaned
   `next-server` processes — identify strays by `/proc/<pid>/cwd`, and kill
   only ones whose cwd is a checkout you're about to serve. Never
   broad-`pkill "next dev"`: other worktrees run their own servers.
5. Snapshot the shared dev DB's protected state (fixture counts, the real
   rows) so briefs can name it concretely and the end-of-run check can prove
   it survived. Don't hardcode stale numbers from memory.
6. Spot overlaps: issues touching the same surface (same route, same server
   module) need coordination notes in their briefs — tell each implementor
   what the other is changing and how to stay mergeable.

## Phase 1 — Worktrees

Per issue `<n>`: `git worktree add ../octavo-wt-<n> -b <type>/<n>-<slug> main`,
copy `.env.local` from the main checkout, and run `npm install` in the
background (node_modules is not shared). Assign dev port **3000 + n** (check
it first; pick a free neighbour on collision). Spawn each implementor as soon
as its install finishes — don't serialize on the slowest.

## Phase 2 — Spawn implementors

One Agent per issue, **named `impl-<n>`** so you can SendMessage it through
review iterations, spawned in parallel. Model: `model:opus` label → pass the
`opus` override; `model:fable` or unlabeled → inherit the session model. An
explicit `all-opus`/`all-fable` argument wins over labels.

Build each brief from `references/implementor-brief.md` — read it and fill
every placeholder. The brief is load-bearing: agents given the full issue text
verbatim, the exact gates for their change type, the port/pkill rules and the
DB protections have succeeded on the first pass; vague briefs come back as
review churn.

## Phase 3 — Review each PR as it arrives

This pass is why the loop produces mergeable work — read
`references/review-pass.md` before your first review and follow it per PR.
The short form: read the full diff yourself; re-run every gate yourself in
that worktree; verify UI claims in headless Chromium yourself with scratch
rows you created (run-stamped, never fixtures); post findings as **inline PR
comments**; SendMessage the implementor to fix and re-push; re-verify; then
post an explicit "orchestrator sign-off" comment and tell the user.

Two hard-won rules: **verify implementor claims independently** — including
bug reports; a "deterministic, environment-X-only" failure may be a flaky one
that rolled the same way repeatedly, so sample a repro several times per
environment before accepting any conclusion about where it lives. And when a
finding is out of the issue's scope, **file a new GitHub issue** with your
verified evidence rather than stretching the PR.

If a subagent dies mid-task (session limit, crash), its worktree state
survives — once the cause clears, SendMessage it to resume from `git status`,
not restart from scratch.

## Phase 4 — Integration (2+ issues only)

When every PR is signed off:

1. `git worktree add ../octavo-wt-integration -b integration/<n1>-<n2>-… main`,
   `npm install`, copy `.env.local`. This branch is **never pushed or merged**
   — it exists only for combined testing.
2. Merge the branches in — smallest / most-conflicting first. Resolve
   conflicts yourself, favouring each PR's intent; note anything
   judgement-heavy for the user. (Prevention beats resolution: when two branches
   need the same new helper, have the second implementor create it
   **byte-identical** to the first's — identical new files and identical hunks
   merge silently.)
3. Run the full gate suite there: lint, both typechecks, build, every
   browser gate the changes touch, plus your own end-to-end spot checks over
   each changed surface at desktop and ~390px widths.
4. Free port 3000 of orphans (by `/proc/<pid>/cwd`), start `npm run dev` there,
   and leave it running.

## Phase 5 — Report to the user

PR links with one-line sign-off notes; conflict resolutions; any issues you
filed; and a concrete click-by-click test script per surface, signed in as
the admin (dev logs the magic link — suggest `! tail -f <dev-log-path>` so it
lands in their terminal). Remind them: test on http://localhost:3000, then
merge the PRs individually — whichever overlapping PR merges second needs a
mechanical rebase you'll handle on request. Do not merge unless they
explicitly ask; if they do, note that branch protection may require the
`--admin` bypass on their own PRs, and say so in your report when you use it.

After merges (theirs or requested-of-you): confirm the merged `main` tree
matches what you gate-tested (`git diff <main> <integration-branch>` should be
empty when everything landed), verify the issues auto-closed, clean up the
feature worktrees and branches, verify the protected DB rows one last time,
and keep the integration worktree + server only until the user is done testing.

## Throughout

- Keep the user updated in short notes: each PR opened, each review verdict, each
  sign-off. Lead with what happened, not process.
- Anything only a human can do (merges by default, accounts, DNS, deploys)
  goes to the user, not around them.
- Never run `npm run db:seed`. Never touch DB rows you didn't create.
- If an issue balloons past its brief, split a follow-up issue rather than
  stretching the PR.
