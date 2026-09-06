# ASTRA 01 — Folio

An editorial reading room built around a full-width publication masthead, a three-part lead story (introduction, real cover, contents), and a ruled back-issue shelf. Warm paper, Newsreader headings and a burgundy interface accent give it the character of a printed journal.

The publishing desk uses generous serif navigation and a quiet ruled issue list. The editor moves the page rail to the right and keeps insertion/history tools in a full-width strip below the canvas. The reader has a persistent high-contrast control strip and larger contents entries. Sign-in becomes a split introduction and member form; dialogs, settings, recovery, missing pages and loading states share the same rules and squared controls.

Authored content is preserved: CSS snapshots the original deployment tokens on the root and restores them on fixed page frames, mobile articles and PDF wrappers. Fonts, page dimensions, content schema, server actions, permissions and integrations are unchanged. No render-version bump is needed because the printed page rendering is unchanged; browser gates verified page geometry and generated actual PDFs.

All alternatives start at `30019b9eed0473d593fd8a165b13e5951f2a933c`. Branch `codex/ASTRA-option-1-folio`. Local preview `http://localhost:3101`; fresh sample accounts `member@example.com` and `admin@example.com`. Each has real magic-link authentication; development links print in the local server log and no real email is sent.

See the ASTRA comparison report beside the worktrees for final paths, restart scripts, screenshots and verification evidence. The editor retains Octavo’s existing desktop/tablet viewport gate; phone reading and administration remain available.
