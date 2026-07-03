# Roadmap

How the app gets from "runs locally" to a hosted, members-only magazine the club runs
itself. **Work is tracked as GitHub issues** — one milestone per phase, one issue per
agent-sized task. Read this file for the ordering and the *why*; read the issue for the
task brief; read the code for the *how*.

This file supersedes `docs/planning/` (removed — see git history for the original spec,
design handover and implementation plan). Still-current infrastructure/runbook detail
lives in [infrastructure.md](infrastructure.md).

## Product model (decisions that shape everything)

Carried forward from the original spec — these are settled:

- **Two roles, one auth system.** A member is an email on the club list; an admin is a
  member with `is_admin`. Magic-link sign-in only — no passwords, no OAuth.
- **The new-issue email IS the magic link.** Publishing an issue emails every subscribed
  member a personal sign-in link straight to that issue. There is no separate "log in"
  ceremony; the `/signin` page is the fallback, and an expired link silently sends a
  fresh one rather than erroring.
- **Self-service club, landlord developer.** The admin runs publishing, members, and
  sponsors entirely from the UI; the developer owns only infrastructure (Railway, R2,
  domain, email) and should rarely touch it. Favour boring, managed choices.
- **Blocks JSON is the source of truth.** HTML views and the PDF are derived artifacts.
- **Audience:** ~1,000 members, older, phone-heavy. Readability and simplicity beat
  features; WCAG AA is a requirement, not a nice-to-have.

## Open decisions (settle before the affected issue starts)

1. **Fully gated vs unlisted?** Is `/read` members-only (strict gate) or is the content
   merely unlisted? Affects Phase 1's reader gating and the image-serving model.
2. **Image privacy.** Public R2 URLs with unguessable keys (cheap, edge-cached,
   recommended) vs signed URLs (true members-only, more moving parts). Follows from #1.

## Phases

Each phase is a GitHub milestone; issues within it are ordered. Finish (or consciously
skip) a phase's issues before starting the next — later briefs assume earlier merges.

### Phase 0 — Deployable (#1–#2)

Remove everything that breaks or loses data on first Railway deploy: fail-closed R2 in
production (no silent ephemeral-disk fallback), migration cutover (`drizzle/` committed,
migrate on deploy), Node pinned, health check, noindex until auth exists. Plus the small
correctness fixes from the 2026-07 code review.

### Phase 1 — Auth (#3–#6)

Auth.js magic-link with Resend + the Drizzle adapter (tables already exist). Explicit
`requireAdmin()` in every server action and the upload route — middleware is
belt-and-braces only, since server actions bypass route matchers. Gate the reader per
open decision #1. Long-lived sessions (~90 days) so members aren't re-requesting links.
Rate-limit upload + signin. Decide and implement the image-serving model.

### Phase 2 — Members, sponsors, mailing (#7–#9)

Members CRUD on the `users` table (add/remove, CSV import — the UI stubs exist).
Sponsors table + admin page, sponsor blocks referencing it (bump `CONTENT_VERSION`).
Then the payoff: publish → Resend batch email to subscribed members with unsubscribe
handling. This is the phase where the product does what it's for.

### Phase 3 — Accessibility & landing page (#10–#11)

Fix the three WCAG-AA-failing tokens (`--color-faint`, `--color-faint2`, `--color-warn`);
semantic headings in `BlockView` on the read path; keyboard page-turns and a visible
control bar in the desktop reader; dedicated alt text on image blocks; 44px tap targets.
Landing page: editorial standfirst from `site.tagline`, real nav (member sign-in, not a
public Admin link), year-grouped archive, footer, LCP priority on the hero cover, and no
dead buttons anywhere a member or admin can see.

### Phase 4 — Hardening & operability (#12–#15)

Nonce-based CSP (drop `'unsafe-inline'` from `script-src`); move rich text to structured
Tiptap JSON so `dangerouslySetInnerHTML` disappears; split the double reader mount so
phones stop downloading the flipbook; extract the duplicated pan/zoom hook (also fixes
both >500-line files); hex→token sweep. Ops: Sentry, CI (lint + typecheck + build),
verified Postgres backups, documented restore path.

### Phase 5 — Launch niceties (#16)

On-demand PDF export (Playwright prints the fixed canvas; cache to R2), wire the PDF
buttons, TOC deep-links, and whatever real users ask for first.

## Cost when live

Railway ~$5–20/mo · R2 ~free at club scale · Resend Pro ~$20/mo (a 1,000-member blast
exceeds the free tier) · domain ~$12/yr. Details in [infrastructure.md](infrastructure.md).
