# ASTRA option 3 — Index

Index treats the magazine as a living publication catalogue. Large sans-serif
headlines establish the issue, monospaced numbers establish its place in the
collection, and strong rules make sections easy to scan. Cobalt marks the next
action against ivory and ink. Controls are squared and persistent.

The member library presents the latest issue as an asymmetric cover and contents
spread. On a phone, its title and reading actions come before the cover. The
archive groups numbered, horizontal catalogue entries by year. Its existing
search, filtering, pagination and library cap remain unchanged.

The administrator uses a narrow numbered navigation rail. Issues read as
catalogue rows with clearly separated status and editing actions. Members,
sponsors, magazine settings, the guide, dialogs and supporting account screens
share the same type and control language. The editor is a three-pane publishing
workbench: pages on the left, an unchanged fixed canvas in the middle, and
labelled Insert, Page and History groups on the right. Every existing editor tool
remains available. Its status badge now reflects the existing published state.

## Authored-content boundary

`src/app/index.css` snapshots the deployment palette and serif font at the root,
then applies Index tokens to the application body. Fixed page frames, flowing
mobile articles and print documents restore those snapshots. Content geometry,
block renderers, layout themes, imagery and PDF cache version remain unchanged.
The contrast gate checks both underlying brands and both Index chrome palettes.

## Verification

Lint, application TypeScript, script TypeScript, touched-file formatting, the
extended contrast gate and a production build pass. Real development magic-link
sign-in passes for both isolated fixture accounts. A Chromium pass covered
library, archive, issues, members, sponsors, magazine settings, guide, desktop
reader and editor at 1440 × 1000, plus main phone screens at 390 × 844; there were
no page errors or horizontal document overflow. The editor's authored page was
measured with its original Newsreader font, green accent, ink and 900px height.
The orchestrator records the independent workflow gates and final screenshots.
