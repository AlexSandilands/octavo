# Redesign option 1 — "Broadsheet"

The club magazine as a **large-print printed bulletin**: black ink on white paper, one signature
red, strong horizontal rules, and everything said in words. Older readers should feel they are
holding the newspaper they trust, not learning an app. Hierarchy is carried by type size and
rules, never by colour, shadow or a hidden icon.

## Why this direction suits the audience

The members are older and many read on a phone. Print conventions are the ones they already
know: a masthead, a dateline, section tabs, numbered contents, "Previous page / Next page".
Every control is a word (or a word beside an icon), every status is a boxed label, and nothing
floats over the content. High contrast (near-black on white) and 18px body text carry the
legibility; rules and whitespace carry the structure.

## Principal decisions

**Two palettes, one theme block.** The magazine's page pipeline (`src/features/blocks/**`, the
print document, the PDF) keeps every token it consumed — by name and by value — plus
`--font-serif` / `--font-sans` / `--font-mono` and the Newsreader / Hanken / Plex bindings, so an
authored page renders exactly as before. The chrome is built on its own namespace so a missed
rename can never bleed into a printed page:

| Group   | Tokens                                                                      |
| ------- | --------------------------------------------------------------------------- |
| Paper   | `sheet` #ffffff · `newsprint` #f3f2ee (stages, zebra rows)                   |
| Ink     | `lead` #141414 · `grey` #444441 · `grey-soft` #5d5d58                        |
| Rules   | `lead` for heavy rules · `hairline` #d6d3cc                                  |
| Accent  | `red` #8a1c2b (oxblood, AA on white) · `red-deep` #6e1522 (hover)            |
| Shape   | `rounded-ui` = 2px; no shadows anywhere                                      |
| Type    | `--font-display` = Fraunces (variable, soft optical size) · `--font-ui` = Public Sans |

`coastal` becomes a navy-accent variant of the same system; `BRAND_ICON_COLORS` follows.
`scripts/dev-contrast-gate.mts` checks the page pairs as before and every chrome pair.

**Typography.** Fraunces for headlines and the wordmark; Public Sans for UI at 18px / 1.55;
labels and kickers as 13px tracked small caps; tabular figures for numbers.

**Navigation model — the masthead.** Every member page opens with a newspaper masthead
(`src/features/library/masthead.tsx`): a small-caps dateline (club name · latest issue and
month), the wordmark set large and centred, a heavy rule, and a row of text tabs — `Latest`,
`Archive`, `Email preferences`, `Admin` (admins), `Sign out` — the active one underlined by the
heavy rule. On phones the tab row scrolls horizontally; there is no hamburger or drawer anywhere.
The admin uses the same masthead with an "Admin" dateline and the tabs `Issues · Members ·
Sponsors · Magazine · Guide` plus `Back to library`; the sidebar and off-canvas drawer are gone
(`ADMIN_NAV` remains the single source of the tab list).

**Library = the front page.** Kicker, the latest issue's title as a full-width headline, a
standfirst (No. · pages · month), then the cover (1px ink border) beside a numbered "In this
issue" index with dotted leaders and two labelled buttons, `Read this issue` (red) and
`Download PDF` (outlined). Back issues are a **rule-separated list**, not a grid: small cover,
bold number, serif title, month and page count, `Read` / `PDF` text links, year headings as
small-caps section rules. `/archive` is the same list under a labelled form row ("Search
titles", "Year") with `← Newer issues` / `Older issues →` and "Page n of m".

**Reader.** Desktop: no floating dock. A toolbar row under a slim masthead bar — `← Library`;
`◀ Previous page` / "Page 3 of 6" / `Next page ▶`; `Contents`, `Zoom −` / % / `Zoom +`, `Full
screen`, `Download PDF`, and a labelled `Look: Classic / Modern` select. The contents panel is a
white column with rule-separated rows and a red rule on the current page; a quiet keyboard hint
sits under the toolbar. Mobile: a sticky top bar (`Contents` → full-screen list with a Close
button, `Smaller` / `Larger`, `PDF`), heavy rules between sections, `Next: <section>` links and
`Back to top`. `reader-spread.tsx` mechanics are untouched.

**Admin.** Real tables with a small-caps header row, zebra rows and rules; row actions are
text buttons (`Edit`, `Delete`, `Make admin`, `Unsubscribe`); search and filters as a labelled
form row; the bulk bar as a rule-bounded band; big red labelled Create/Add buttons; empty states
as boxed notices. Dialogs (`DialogShell`, restyled once) are square white sheets with a heavy
top rule, the title in Fraunces, and a rule above the button row. Magazine settings are one long
form with rules between groups and the live preview beside it (resizable split kept); the help
guide reads as a broadsheet article with its six figures redrawn in the chrome palette.

**Editor.** Print-shop chrome: top bar (`← Issues`, title, DRAFT box, "Saved", `Add a logo`,
`Look:` select, `Preview`, red `Publish`); the insert and undo/redo controls as a **labelled
toolbar row** under the header instead of a floating pill; a numbered page rail with rule
separators; a 2px ink selection outline with labelled chips (`Move up`, `Move down`, `Delete`).
All behaviour is unchanged.

**States.** Grey rule-and-bar skeletons; errors as boxed notices with a red left rule; success as
a boxed notice with a check.

## Verification

Run by the orchestrator against the worktree's dev server on port 3201 with its private
database, after the implementors' passes:

- `npx tsc --noEmit` — clean. `npm run lint` — clean.
- `npx tsx scripts/dev-contrast-gate.mts` — all 112 checks pass (page pairs + chrome pairs, both
  brands).
- Content-token freeze check — pass: the five page-pipeline paths are identical to the start
  commit, the 21 block-consumed colour tokens and the three content fonts are unchanged.
- Screenshot harness at 1280×800 and 390×844 over 17 screens (sign-in, library, archive,
  reader desktop + mobile, preferences, admin lists, magazine, guide, editor desktop + mobile,
  not-found) — see the comparison set in the orchestrator's report.

Not run by the orchestrator (the implementors ran parts of them before being interrupted, so
treat as unverified): the headless browser gates (`scripts/dev-*-gate.mts`), the manual keyboard
walkthrough, `npm run build`.

## Known limitations

- The finishing pass was interrupted: a "Joined" cell wrap in the members table and a logo-picker
  label were on the implementor's fix list when work stopped.
- Browser gates that assert old control names (e.g. the theme trigger, now "Look:") were
  updated in the plan but not all re-run.
