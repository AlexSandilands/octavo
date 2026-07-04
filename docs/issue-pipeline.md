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
| #10 | Drawer-close focus restore stole focus from TOC-jump target |
| #12 | Clean implementation; review only added missed doc updates |
| #13 | Review clean — but the **user's browser pass** caught a real bug post-review: ProseMirror emits null-prototype `attrs` objects, which React Flight silently replaces with opaque temporary references on the server-action call, so saving any link mark or ordered list failed. Fixed with a plain-JSON round-trip in the editor's `onUpdate`. |
| #14 | Clean (orchestrator re-verified drift line-by-line + scripted the hex↔token equivalence) |

Lesson from #13: the **user's manual browser pass is as load-bearing as the diff
review** — client→server transport bugs are invisible to server-side verification,
so treat the browser checklist on each PR as a required gate, not a courtesy.

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
  (fish) shell. Run it as a **standalone** command: inside a compound command the
  pattern matches your own shell's command line and kills it (exit 144).
- Wipe `.next` after switching branches.
- Never run two dev servers in one checkout.
- A production build requires R2 env vars. For local build/verification, prefix with
  dummies: `env R2_ACCOUNT_ID=x R2_ACCESS_KEY_ID=x R2_SECRET_ACCESS_KEY=x R2_BUCKET=x
  R2_PUBLIC_URL=https://pub-test.r2.dev npm run build`. To also make locally-uploaded
  images render in that prod build, use `R2_PUBLIC_URL=http://localhost:3000/api/images`
  instead — the local-disk serving route answers it (new uploads still fail: writes go
  to real R2).
- The user runs all browser/E2E checks themselves — do not install Playwright browsers.

## Status (2026-07-04)

Phases 1–3 complete (**#6–#14 merged**). Phase 4 remaining, in order:

| Order | Issue | Label | Task |
| ----- | ----- | ----- | ---- |
| 1 | #15 | opus | Ops (Sentry, CI, backups + restore runbook) |
| 2 | #16 | fable | On-demand PDF export (Playwright), cached to R2 |

Side trackers (not phase work): **#33** UI papercuts (batch-fix when convenient),
**#36** structural follow-ups from #14 (preview double-bundle, unused `page-flip`
dep, `editor.tsx` at 495 lines, seed should emit v3-shaped content).

Notes for whoever picks this up:

- Content is **v3** (Tiptap JSON body text; #13). `npm run db:migrate-content` exists
  for any DB that ever holds pre-v3 strings — the local dev DB is already migrated,
  and nothing is deployed yet, so it likely never needs to run again.
- The CSP is nonce-based in `src/middleware.ts` (#12) — new pages must render
  dynamically (a static prerender gets no nonce and `'strict-dynamic'` blocks it).
- The readers lazy-load per viewport via `ReaderMount` (#14); the admin preview route
  deliberately still double-bundles (see #36).
