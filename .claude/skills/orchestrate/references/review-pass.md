# The orchestrator review pass, per PR

Nearly every agent run needs at least one orchestrator fix before it's safe to
merge (`docs/workflow.md` §"Why the review pass is load-bearing"). The
implementor's report is a map, not evidence — everything below you do
yourself, in their worktree.

## 1. Read the full diff

`git diff main...HEAD` in the worktree (chunk it for big PRs; persist large
output to a file and Read it). While reading, look for:

- Correctness at boundaries: zod on every URL/action input, malformed input
  degrading rather than erroring, admin gates inside every action.
- The repo's known bite-points: timezone splits between SQL and Node (a bare
  `extract(year …)` runs in the Postgres session zone; JS `getFullYear()` in
  Node's — one rule must feed both), Drizzle bind parameters repeated across
  SELECT DISTINCT / GROUP BY / ORDER BY (each occurrence is a fresh
  placeholder; Postgres rejects the statement), destructive paths reusing the
  existing cleanup routines rather than bare SQL.
- Policy: comments 1–2 lines, **no issue refs** in code comments.
- Cross-PR collisions: a helper landing in two in-flight branches must be one
  byte-identical file imported from identical line positions.

## 2. Re-run every gate yourself

Same list the brief gave them: lint, `npx tsc --noEmit`,
`npm run typecheck:scripts`, prettier on touched files, clean `npm run build`,
plus every browser gate for the change type — against a dev server **you**
start on their port and stop afterwards (kill by `/proc/<pid>/cwd`, then
confirm the port is free; a compound-command pkill can self-match and exit
144 — that's the kill landing, not a failure).

## 3. Verify UI claims end-to-end yourself

Write a short Playwright spot-check (run it from the worktree's `scripts/` so
module resolution works; delete it after). Mint an admin/member session the
way the committed gates do, create your own run-stamped scratch rows
(`iorch <stamp> …`), drive the actual claims — composition of filters,
counts being honest, destructive flows only against your own rows — and
finish by proving the protected fixtures are untouched and your scratch rows
are gone. Review the implementor's screenshots too, but never as a substitute.

## 4. Post findings as inline PR comments

`gh api` with `-f`-style array params mangles the comment array — write JSON
and use `--input`:

```bash
gh api repos/{owner}/{repo}/pulls/{n}/reviews --input review.json
# review.json: { "event": "COMMENT", "body": "<summary of what you verified>",
#   "comments": [ { "path": "...", "line": 123, "side": "RIGHT", "body": "..." } ] }
```

The review body should say what you verified and how (gates re-run, your own
browser pass), so findings read against a background of evidence. Then
SendMessage `impl-<n>` with the findings, the reasoning, and exactly what to
re-run before re-pushing. Tell them anything that changed under them (ports
freed, another PR's sign-off state, shared-DB churn that may flake a count).

## 5. Verify the fix, then sign off

Re-read the fix commit, re-run the gates it touches, re-run your spot check.
Only then post the sign-off comment — say what was verified and under whose
run ("re-run by me"), note any merge-ordering hazards with sibling PRs, and
tell Alex it's ready for their browser pass. **Do not merge** — Alex merges,
unless they explicitly ask you to (their own PRs can't self-approve, so a
requested merge may need `--admin`; disclose when used).

## Verifying claimed bugs (before filing or relaying)

An implementor reporting a bug outside their diff is reporting a hypothesis.
Before filing an issue or alarming Alex:

- Reproduce it yourself with their script or your own.
- **Sample flaky repros several times per environment.** A failure that hit
  4/4 in one checkout and 0/1 in another looks environment-specific and may
  just be an unlucky/lucky streak — run each environment repeatedly before
  concluding where the bug lives.
- Isolate with discriminating experiments (same code different environment;
  same environment different code; fresh `npm ci`) rather than accepting the
  first coherent story.
- File the issue with the verified evidence matrix, corrected conclusions,
  and acceptance criteria that include a committed regression gate.
