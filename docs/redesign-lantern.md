# Redesign option 3 — "Lantern"

**The reading room after dark.** Dark, quiet chrome frames the paper pages so the magazine is
the only bright thing on screen — the cover glows like a lit page. Cover-led and cinematic: the
library is a shelf of lit covers on a dark wall, the reader a paper page on a dark desk, the admin
a dark workshop around a paper canvas. Content surfaces (pages, forms, dialogs, tables) stay light
for reading comfort; only the chrome is dark.

## Why this direction suits the audience

Members come for the pages. Putting everything else in the dark makes the page the obvious
place to look, and gives the covers — the thing members recognise an issue by — the whole
stage. Light-on-dark chrome text is set at 17–18px and a slightly heavier weight so thin strokes
don't vanish for older eyes, and forms and tables stay on paper, where reading is easiest.
Navigation is one big menu that works identically on a phone and a desktop, so there is one thing
to learn.

## Principal decisions

**Two palettes, one theme block.** The magazine's page pipeline (`src/features/blocks/**`, the
print document, the PDF) keeps every token it consumed by name and value, plus `--font-serif` /
`--font-sans` / `--font-mono` and the Newsreader / Hanken / Plex bindings, so authored pages
render exactly as before. The chrome gets its own tokens:

| Group    | Tokens                                                                       |
| -------- | ---------------------------------------------------------------------------- |
| Chrome   | `ground` #17181c · `raised` #1f2126 · `lifted` · `hairline` #2a2d34            |
| Text     | `chrome-text` #ece7dc (≥12:1) · `chrome-muted` #b9b3a6 (≥7:1)                   |
| Accent   | `brass` #e0b45c on dark (charcoal text on brass fills) · dark brass #6f5212 on light |
| Status   | `danger` red, `caution` amber — AA on both grounds                            |
| Depth    | `shadow-glow` (covers on the dark stage) · `shadow-panel` · `shadow-sheet`; 6px radius |
| Type     | `--font-display` = Libre Caslon Text · `--font-ui` = IBM Plex Sans · `--font-meta` = IBM Plex Mono |

`coastal` becomes a slate + verdigris variant; `BRAND_ICON_COLORS` follows.
`scripts/dev-contrast-gate.mts` is extended to assert the dark-chrome pairs (chrome text and
muted on ground/raised, charcoal on brass, brass on ground ≥ 3:1 for UI).

**Typography.** Caslon for the wordmark and headings; Plex Sans for UI; Plex Mono for all
metadata — issue numbers ("No. 06"), dates, page counters, year markers, status labels.

**Navigation model — one menu.** A slim dark site bar (`src/components/site-bar.tsx`) on every
member page: wordmark left, `Menu` (icon + word) right. `Menu` opens a full-screen dark overlay
through `DialogShell` (`site-menu.tsx`) — focus trapped, Escape closes, a big labelled `Close` —
with very large links: `Library`, `Archive`, `Email preferences`, `Admin` (admins), `Sign out`,
and the signed-in name and email in mono at the foot. The admin adds a persistent 80px dark rail
on desktop (icon over label, brass marker on the active item, `Library` at the bottom) and uses
the site bar + overlay on phones; `admin-shell` / `admin-drawer` / `admin-nav-content` are
replaced, with `ADMIN_NAV` still the data source.

**Library.** The dark stage. Hero: the latest cover, large and centred with the glow; a mono
line (No. · month · pages), the title in Caslon off-white, the first sections in mono separated by
middots, `Read` (brass) and `Download PDF` (outlined). "On the shelf": a horizontal scroll-snap
shelf of lit covers on desktop with keyboard-focusable `Previous` / `Next` shelf buttons and
arrow-key scrolling, a vertical stack of large covers on phones; year markers in mono brass;
`Full archive` when the catalogue is longer. `/archive`: a light search field with a visible
label on the dark bar, a `MenuSelect` year filter, a grid of lit covers with mono captions,
outlined `Newer` / `Older` and a mono "2 / 3".

**Reader.** Desktop: dark top bar (`← Library`, title, brass `Classic | Modern` segmented
control, `Download`, `Full screen`), a collapsible dark contents panel (mono numbers, serif
titles, brass rule on the current row), a dark bottom bar (`Previous` / `Next`, mono counter,
zoom `−` / `+`); the paper spread glows on the stage. Mobile: a dark top bar (`Back`,
`Contents`, `A−` / `A+`, `Download`) over the light continuous sheet with dark gutters, contents
as a full-screen dark overlay, a dark closing band with the lockup. `reader-spread.tsx`
mechanics are untouched.

**Admin.** Dark rail + dark top bar; the content pane is a paper sheet floating on the dark
ground. Light tables with mono statuses (`PUBLISHED` dark brass, `DRAFT` muted), a light toolbar
for search and filters, row actions with visible labels, a dark bulk band pinned to the sheet's
foot with brass count text. Brass primary buttons, outlined secondaries. Dialogs are light panels
over a dark scrim with a Caslon title and mono helper text. Magazine settings: grouped light
cards with the live preview on the dark ground so the page glows as it will in the reader
(resizable split kept); the logo library as light tiles. The help guide is a light article sheet
with mono section numbers and its figures redrawn in the chrome palette.

**Editor.** Design-tool chrome: dark header (`← Issues`, Caslon title, mono `DRAFT · No. 6`
chip, mono "Saved", `Add a logo`, theme `MenuSelect`, outlined `Preview`, brass `Publish`), a
dark page rail with paper thumbnails and mono numbers (brass outline on the active page), the
canvas ground dark so the page glows, the insert/undo controls as a dark bottom bar with
icon+label buttons, a dark-brass 2px selection outline and dark block-handle chips. All behaviour
is unchanged.

**States.** Dark ground with paper skeleton blocks; errors as a light sheet with a red rule and
`Try again`; success as brass check + text.

## Verification

Run by the orchestrator against the worktree's dev server on port 3203 with its private
database, after the implementors' passes:

- `npx tsc --noEmit` — clean. `npm run lint` — clean.
- `npx tsx scripts/dev-contrast-gate.mts` — all 134 checks pass (page pairs, chrome pairs,
  both brands).
- Content-token freeze check — pass: the five page-pipeline paths are identical to the start
  commit, the 21 block-consumed colour tokens and the three content fonts are unchanged.
- Screenshot harness at 1280×800 and 390×844 over 17 screens — see the comparison set in the
  orchestrator's report.

Not run by the orchestrator (the implementors ran parts of them before being interrupted, so
treat as unverified): the headless browser gates (`scripts/dev-*-gate.mts`), the manual keyboard
walkthrough, `npm run build`.

## Known limitations

- The finishing pass was interrupted while checking the help guide's step text on the light
  sheet and re-running the reader gate; those are unconfirmed.
- Brand skins now carry two palettes; a new brand must set both.
