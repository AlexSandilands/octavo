# Redesign option 2 — "Compass"

Octavo as a friendly app: one shell for members and admins, big rounded controls, a
bottom tab bar on phones, white cards on a cool light ground, and a typeface designed
for low-vision readers. Wayfinding is the theme — you always know where you are and
how to get back. It should feel like a well-made phone app that also works on a
desktop, not a website.

## Why this direction suits the audience

The members are older and phone-heavy. A magazine-styled website asks them to learn
where things are on every page; an app shell gives them the same three places
(Library, Archive, Account) in the same spot on every screen, with a label under every
icon. Controls are pills you cannot miss (48px on a phone, 44px minimum everywhere),
text is 18px Atkinson Hyperlegible with distinct letterforms, and every state — a
selection, an error, a success — is a tinted card with an icon rather than a colour
change alone. Admins get the same shell with a fourth tab, so running the magazine on
a phone (adding a member on the bus) is ordinary rather than heroic.

## Principal decisions

**Two palettes, one theme block.** The magazine's page pipeline (`src/features/blocks/**`,
the print document, the PDF) keeps every token it consumed — paper/page/card/tint, the
accent family, ink/muted/faint, hairlines, page decorations, and `--font-serif` /
`--font-sans` / `--font-mono` — by name and by value, so an authored page renders
byte-for-byte as before. The chrome is built on a new app palette:

| Group     | Tokens                                                          |
| --------- | --------------------------------------------------------------- |
| Surfaces  | `ground` #f5f6f8 · `surface` #fff · `surface-2` · `stage-ui`    |
| Primary   | `primary` #2447c6 (cobalt) · `-strong` · `-soft` · `-wash`      |
| Text      | `fg` #16192b · `fg-muted` #4d5468 · `fg-faint`                  |
| Lines     | `hairline` #dfe2ea (cards) · `edge` #808a9e (3:1 control edges) |
| Status    | `ok` / `warn` / `danger`, each with a `-soft` tint              |
| Elevation | `shadow-card` · `shadow-float` · `shadow-sheet` · `shadow-fab`  |
| Shape     | `radius-card` 16px · `radius-field` 12px · pills at 999px       |
| Type      | `--font-ui` = Atkinson Hyperlegible 400/700 + italics           |

`body` sets Atkinson 18px/1.5 on `fg`; a `[data-page-frame], .page-content` rule pins
the page environment (Hanken 17px/1.6, ink) so the app's type never leaks into an
authored page — verified by pixel-diffing the print route (below). The `coastal`
brand overrides the page palette as before and gets a teal primary for the chrome.
`BRAND_ICON_COLORS` follows the primary/ground pair.

**Typography.** Atkinson Hyperlegible (self-hosted, four static cuts, OFL) for all
chrome; headings in the same face, bold, 28–34px; labels bold 13–14px with 0.06–0.12em
tracking. No display serif in the chrome. Newsreader / Hanken / Plex stay for the pages.

**Colour.** Cool ivory ground, white cards, cobalt as the one accent (AA as text on
white and under white text), a soft cobalt tint for selected rows/tabs/chips, semantic
green/amber/red each AA on its own soft tint. `scripts/dev-contrast-gate.mts` now checks
every app pair (text ≥ 4.5:1 on each surface it may sit on, control borders and the
primary icon colour ≥ 3:1) for every brand, alongside the untouched page checks.

**Spacing and shape.** 16px card radius, 12px fields, 999px pills and chips; one card
shadow for cards, a float shadow for bars/menus/sheets. Content columns are 896px
(member) / full-pane (admin) inside a pane with 20px (phone) / 32px padding.

**Navigation model — one shell.** `src/components/app-shell.tsx` replaces
`admin-shell` / `admin-drawer` / `admin-nav-content`:

- **Phone (<md):** a slim top bar (wordmark, page title, an "Admin" chip in the admin)
  and a 56px bottom tab bar, safe-area aware. Members: Library / Archive / Account.
  Admin: Issues / Members / Sponsors / More (a bottom sheet with Magazine, Guide, View
  library, Sign out). Admins reach the admin from the Account page.
- **Desktop (md+):** a 240px sidebar with the wordmark, icon+label rows with a rounded
  selected state, and the user card + Sign out at the foot. Members see Library /
  Archive / Account (+ an Admin section if they are one); the admin lists its five
  pages plus "Back to library".
- The content pane, not the window, scrolls at every width, so the bars stay put and
  the admin lists' pinned-controls arithmetic (`admin-list-layout.ts`) is unchanged.
- The reader and the editor are full-screen surfaces outside the shell with their own
  top bar and a clear way back.

`ADMIN_NAV` stays the data source (now in `app-nav.ts`, beside `MEMBER_NAV`).

**Information hierarchy.** Every page: one h1, a one-line summary, then cards. The
library leads with a greeting, then the latest-issue card (cover, title, facts, the
first sections as chips, a big Read pill), then recent issues as cards, then the
archive link card. Admin lists open with a stats strip (issues/drafts/published,
members/subscribed, sponsors/expired) drawn from the numbers already on the page.

**Component language** (`src/components/`): pill `Button` (primary/secondary/danger/
quiet, sm/md/lg, leading icons), round `IconButton` (quiet/outlined/solid/danger,
always ≥44px, label = name = tooltip), `Chip` and status `Pill`, `Avatar`, `Wordmark`
with the cobalt book tile; `DialogShell` renders every dialog as a bottom sheet with a
grabber on a phone and a centred card from md (`placement="left"` for the reader's
contents slide-over); `dialog-parts.tsx` (header, body, actions that stack full-width
on a phone, `Field`, `FIELD_CLASS`) so seven dialogs share one geometry; `MenuSelect`
as a pill trigger with a rounded menu; `ListSearch` with a clear ×; `ListPagination`
with configurable words (Newer/Older on the archive); `list-rows.tsx` (cards on a
phone, one table card from md, `RowAction` = round icon on a phone, icon + label from
md, one element so its name never changes); `FloatingBar` for bulk actions;
`AdminPageHeader` with the stats strip; `EmptyCard`; the error card with a red left bar;
`.skeleton` shimmer (static under reduced motion).

## What changed structurally vs. the baseline

- Shell: sidebar/top bar/tab bar/More sheet replace the admin rail + drawer and the
  library header/masthead/footer. Loading skeletons render inside the shell.
- Library: greeting card + latest-issue card + issue-card grid (each card one link);
  `/archive` search in a card with year **chip links** (server-rendered, keep `?q=`)
  instead of a MenuSelect, Newer/Older paging. `archive-search.tsx` folded into
  `ListSearch` (`maxLength` prop).
- `/preferences` is now the **Account** page in the shell: who you are, the email
  setting, the way into the admin (admins), Sign out.
- Reader: desktop top bar (Library, title, theme segmented control, Download), 56px round
  Previous/Next at the stage edges, a bottom control card (Contents, counter, −/%/+
  zoom stepper replacing the slider, Full screen), contents as a left slide-over sheet
  through `DialogShell`. Mobile: sticky top bar, a fixed bottom bar (Contents / text-size
  stepper / Download), a contents bottom sheet whose jump focuses the heading after the
  sheet has closed, "Back to top". `reader-spread.tsx` mechanics untouched.
- Admin lists: card rows on phones, table card on desktop, icon actions with visible
  labels at md+, floating bulk bar; direct Delete/Remove actions kept (the gates and
  the confirm flow drive them by name) rather than an overflow menu.
- Magazine settings: the Details card, the preview in a card, the logo library rows as
  tinted cards, the split rail restyled; one form card kept (one Save) with clearer
  section headings rather than three separate cards — the toggle-below-Save problem on
  phones is real.
- Help: chip contents that scroll to section cards; the six figures redrawn in the app
  palette (mock page content inside them keeps the page tokens).
- Editor: top bar, floating pill tool bar, page-rail number badges, cobalt selection
  ring with round grip/move/delete, pill control bars and rich-text toolbar, sheet
  dialogs, the phone gate as an empty-state card.
- Removed: `admin-shell.tsx`, `admin-drawer.tsx`, `admin-nav-content.tsx`,
  `library-header.tsx`, `masthead.tsx`, `archive-search.tsx`, the unused `Cover`
  component, the reader-chrome/chip/accent-wash/accent-strong/warn-strong/alert tokens.
- `global-error.tsx` (inline styles, no tokens) mirrors the app palette by hand.
- `not-found.tsx`: the inert "Ask about joining" button is gone; Sign in is the action.

## Verification

Run against the worktree's dev server on port 3202 with its private database.

- `npm run lint` — clean. `npx tsc --noEmit` — clean. `npm run typecheck:scripts` — clean.
  `npm run format` — applied.
- `npx tsx scripts/dev-contrast-gate.mts` — all checks passed, both brands (page pairs,
  the new app pairs, scrollbar thumbs).
- Print route pixel diff: `/read/6/print` rendered at 640px before and after, classic
  and modern — **identical** (so the PDF and `RENDER_VERSION` are untouched).
- Browser gates — see the table the final report carries; the archive gate was updated
  for the year chips and Newer/Older, the list-pagination gate for the
  `data-list-summary` summary line.
- Manual Playwright passes (`.data/reader-check.mts`, `.data/editor-check.mts`,
  `.data/shot.mts`): reader keyboard paging, zoom stepper, contents sheet focus in/out,
  mobile contents jump landing on the heading; editor block select, insert + undo,
  publish modal (email box left off), add-page menu; every shell screen at 1280 and
  390 wide. Final harness screenshots in `.data/shots/final/`.

## Known limitations

- Issue cards render the cover at a fixed 144px (the page renderer scales by a fixed
  factor), so the desktop grid is four 164px cards rather than larger ones.
- The reader's zoom is a −/+ stepper (10% steps, 60–300%); the wheel/drag zoom and
  "fit" are unchanged.
- The editor keeps its ≥768px gate; its tool labels still appear from `xl` only.
- Brand skins now carry two palettes; a new brand has to set both (see `brands.css`).
