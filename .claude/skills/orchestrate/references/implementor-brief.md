# Implementor brief template

Fill every `{PLACEHOLDER}`. Keep the structure — each section exists because
its absence produced a real failure in a past run. Spawn with
`name: "impl-{N}"` and the model chosen by the issue's `model:*` label.

---

You are the implementor for GitHub issue #{N} of the octavo repo. Work ONLY in
the git worktree at **{WORKTREE_PATH}** (branch `{BRANCH}`, cut from
up-to-date main). `npm install` has already been run there and `.env.local` is
in place. Do not touch any other checkout of this repo.

## The issue (verbatim)

> {FULL ISSUE BODY, FRESHLY FETCHED, QUOTED}

## Before you start

Read in the worktree: `CLAUDE.md`, `docs/design-principles.md`,
`docs/workflow.md` (especially the gates table and environment gotchas), and
the relevant code. The issue brief is intent; the current code is the source
of truth for the how. Diagnose actual root causes — verify hypotheses in a
real browser rather than assuming.

{COORDINATION NOTES — what parallel issues touch the same surface, and how to
stay mergeable: reuse rather than rewrite shared paths; when you and another
in-flight branch both need a new shared helper, create it byte-identical to
theirs and import it from the same line position, so the branches merge
silently.}

## Project rules (non-negotiable)

- Files under 500 lines; components under ~150. Server Components by default,
  `"use client"` only at interactive leaves. Validate all external input with
  zod (malformed URL/action input degrades to a valid view, never an error
  page). All DB access through `src/server/*` — DB-side search/filter/paging,
  never fetch-all-and-slice. Build controls from the house set (`Button`/
  `IconButton`, `MenuSelect`); every modal goes through `DialogShell`. Every
  admin server action calls the admin gate first.
- Accessibility is first-class (older, phone-heavy audience): 44px+ targets,
  visible focus, WCAG AA, announced result counts, comfortable at ~390px.
- **Comment policy (Alex's explicit instruction): code comments are 1–2
  concise lines, never an essay, and NEVER contain issue numbers or
  references.** State constraints the code can't show; narrative goes in the
  PR body.
- Keep unrelated formatting drift out of the diff — format only files you
  touch.

## Required gates (run all in your worktree, report results)

1. `npm run lint`
2. `npx tsc --noEmit`
3. `npm run typecheck:scripts`
4. Prettier on touched files
5. `npm run build` (plain — no secrets needed)
6. {PER-CHANGE-TYPE GATES from docs/workflow.md's table — e.g. the headless
   Chromium browser pass for any UI surface (desktop + ~390px), the dialog
   a11y gate for any modal, the list-pagination gate, the archive gate, the
   contrast gate, RENDER_VERSION bump…}

For browser passes: Chromium is already installed via Playwright — never
install browsers. Verify end-to-end with a real session (dev logs the magic
link to the console; or mint a DB session cookie the way the committed gate
scripts do). Screenshots are good evidence.

## Dev server rules

- Use **port {PORT}** (`PORT={PORT} npm run dev`). Check it's free first with
  `ss -ltn`.
- NEVER broad-`pkill "next dev"` — other checkouts run their own servers. To
  stop yours, kill only PIDs whose `/proc/<pid>/cwd` is {WORKTREE_PATH};
  killing the npm parent can orphan a `next-server` child that re-binds the
  port, so check for the child by cwd too, and confirm the port is actually
  free afterwards.
- Wipe `.next` before a production build if the dev server ran there. Never
  run two dev servers in one checkout.
- Default shell is fish — prefer `bash -c '...'` for POSIX syntax.

## Database rules (shared dev Postgres — all worktrees share it)

- No `docker` CLI. **Never run `npm run db:seed`** (it wipes issues).
- The DB holds protected rows that MUST survive this run untouched:
  {CURRENT FIXTURE SNAPSHOT — counts and names of fixture rows, plus the real
  rows, as verified in preflight}. You may read fixtures for verification;
  never modify or delete them.
- Any scratch rows you create must be run-stamped (prefix `i{N} <short-stamp>`),
  tracked by id, and deleted by those ids when done. Destructive tests must
  only ever target rows the test itself created — verify your selection
  matches exactly your own ids before any delete.

## When done

1. Commit with a conventional-commit title ending in `(#{N})`. End the commit
   message with:
   `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
2. Push the branch and open a PR against `main` with `gh pr create`: the body
   gives root cause/intent, approach, key decisions, and verification evidence
   (gates + browser pass), ending with:
   `🤖 Generated with [Claude Code](https://claude.com/claude-code)`
3. Report to the orchestrator via SendMessage (to: "main"):
   per-acceptance-criterion status, files changed with one-line summaries,
   each gate's result, the PR URL, and any deviations from this brief with
   reasons.

Leave the dev server stopped when you finish. If the work balloons past the
issue's scope, stop and report rather than stretching the PR.
