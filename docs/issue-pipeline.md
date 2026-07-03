# Issue pipeline — how agent-assisted issues get built

How we work GitHub issues with Claude Code: a label routes each issue to a model, a
subagent does the implementation, and the orchestrator reviews every diff before it lands.
This file is the process; [ROADMAP.md](ROADMAP.md) is the ordering and the _why_; the issue
brief is the intent; the code is the source of truth for the _how_.

## Routing: one label per issue

Every open issue carries exactly one label that decides which model implements it:

- **`model:fable`** — complex, UI-sensitive, or security-critical work.
- **`model:opus`** — well-specified tasks that mirror patterns already in the codebase.

## The loop, per issue

1. **One subagent per issue** (Claude Code Agent tool). For `model:opus` issues, pass the
   `model: "opus"` override; `model:fable` issues use the default.
2. **Sequential, not parallel** — a single shared working tree, no git worktrees. One issue
   at a time.
3. **Branch per issue.**
4. **The agent does NOT commit.** It implements and reports back.
5. **The orchestrator reviews the full diff**, re-runs verification (lint + tsc, plus the
   issue's `scripts/dev-*-gate.mts` e2e gate), fixes findings directly, commits, and opens
   the PR. Merge `main` into the branch first if `main` has moved.

## Why the review pass is load-bearing

Keep it — it is not ceremony. Every agent run so far has needed at least one orchestrator
fix before it was safe to merge:

| Issue | Bug the review caught |
| ----- | --------------------- |
| #6 | Spoofable `X-Forwarded-For` hop |
| #7 | Unlocked last-admin race |
| #8 | DB-state clobbering |
| #9 | Stale-import merge break + flaky e2e |

## Briefing an agent

Hand each subagent:

- The **full issue text verbatim**.
- The **project non-negotiables** (see [CLAUDE.md](../CLAUDE.md) and
  [design-principles.md](design-principles.md)).
- **"Do NOT commit."**
- **"Restore dev DB state"** — `profile.alex@proton.me` (admin) + `member@example.com`,
  both subscribed.
- **"No docker CLI"** in this environment — test the DB directly; the container is usually
  already running.
- **"Send report via SendMessage to main before finishing."**

## Environment gotchas

- Use `pkill -f "next dev"` to stop the dev server — `kill %1` silently fails in this
  (fish) shell.
- Wipe `.next` after switching branches.
- Never run two dev servers in one checkout.

## Status (2026-07-03)

Phases 1–2 complete: **#6–#9 merged.** Remaining, in order:

| Order | Issue | Label | Task |
| ----- | ----- | ----- | ---- |
| 1 | #10 | fable | Accessibility (WCAG AA contrast, semantic headings, keyboard paging, alt text) |
| 2 | #11 | fable | Landing page (standfirst, real nav, year-grouped archive, footer) |
| 3 | #12 | opus | Nonce-based CSP (drop `'unsafe-inline'` from `script-src`) |
| 4 | #13 | fable | Rich text → Tiptap JSON; remove `dangerouslySetInnerHTML` (content v3) |
| 5 | #14 | fable | Bundle & structure (single reader mount, shared pan/zoom hook, hex→token sweep) |
| 6 | #15 | opus | Ops (Sentry, CI, backups + restore runbook) |
| 7 | #16 | fable | On-demand PDF export (Playwright), cached to R2 |

**#13 must follow #8's content-v2 pattern** — bump the block schema to v3 the same way.
