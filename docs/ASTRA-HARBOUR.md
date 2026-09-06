# ASTRA option 2: Harbour

Harbour presents Octavo as a welcoming club space. Deep teal and navy navigation,
warm amber details, generous white cards and Hanken Grotesk distinguish the
application from the magazine pages it contains.

## Principal decisions

- The member home is a two-column hub: a welcome and real library navigation on
  the left, the latest issue and reading actions on the right. The original cover
  is showcased beside a short list of contents. Back issues become roomy cover
  cards. The welcome panel moves above the issue on phones.
- Administration uses horizontal primary navigation above a task workspace.
  Issues, members and sponsors are distinct white rows with comfortable spacing.
  The existing mobile drawer remains keyboard accessible, and existing pinned
  search/filter behaviour is retained.
- The editor separates an editable issue title and save status from issue
  appearance and publication actions. A persistent right panel names every insert
  tool alongside undo, redo and the cover setting. The original page rail stays
  on the left. The panel scrolls at shorter viewport heights.
- Reading controls stay at full contrast. The contents navigation uses a rounded
  panel with a prominent active entry. Desktop paging, zoom, theme choice,
  contents, fullscreen and PDF functionality are retained. Mobile reading keeps
  its flowing article and text-size controls.
- A paired welcome/form composition carries the direction through sign-in and
  sent/error states. Shared buttons, dialogs and settings panels use the same
  rounded shapes and readable sans-serif type.

## Authored content boundary

`harbour.css` captures each deployment's original colour and serif font variables
on the document root. The shell changes them on `body`; `.authored-surface`
restores the captured values on `PageFrame` and the mobile article. This keeps
existing issue colours and type while allowing the surrounding application to
have its own identity. Page dimensions, block rendering, layout themes, footer
geometry, content data and PDF cache behaviour are unchanged.

The contrast gate checks both existing brands and their Harbour shell palettes.
A browser DOM probe confirmed the shell accent is `#164e55` while an authored
surface restores `#1d4d3e` and the exact original Newsreader font stack.

## Isolation and review

- Branch: `codex/ASTRA-option-2-harbour`
- Worktree: `/home/riv/Projects/octavo-ASTRA/option-2`
- Local preview: `http://localhost:3102`
- Restart: `cd /home/riv/Projects/octavo-ASTRA/option-2 && PORT=3102 npm run dev -- --hostname 0.0.0.0 --port 3102`
- Dependencies, environment, database, uploads and build output belong to this
  worktree. No schema, backend integration or real-email configuration changed.
- No commit, push, merge or deployment was performed.

The experiment's root report records the final comparable screenshots and flow
checks across all three options.
