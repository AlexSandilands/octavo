# Changelog email generator

This repo-local tool turns the changes since the latest `v*` release tag into an editable,
email-ready HTML preview in the Octavo house style. It reads Git only: there is no database,
dev server or GitHub login involved.

## Usage

```sh
npm run changelog
```

The command writes two files under `.data/` and opens the preview in the default browser:

- `changelog-notes-<from>-to-<to>.md` — the **highlights**, the client-facing part of the
  email. The first run drafts it with one headline per user-facing pull request and the
  commits inside each as a comment. Rewrite each headline as one plain sentence, say beneath
  it what the change means for readers or the editor, delete anything not worth a mention,
  then run the command again. The file is kept between runs, so the prose survives new
  commits landing on `main`.
- `changelog-email-<from>-to-<to>.html` — the preview. The email opens with the date and a
  short stat strip (features, fixes, days since the last update), then the highlights in
  numbered groups, then **Every change in detail**: one entry per pull request with the
  smaller steps inside it, for anyone who wants the full list. Untick _Include the detailed
  list_ in the toolbar to send the highlights alone. Click into the preview to adjust wording
  before copying.

Notes file format: `# Heading` starts a section (any title; the draft uses _New features_ and
_Fixes and improvements_), `## Headline` starts a highlight, the lines beneath are its prose
(blank line for a new paragraph, `**bold**` for emphasis), and `<!-- -->` comments are ignored.

Use **Copy email & open Proton** to put the rich HTML on the clipboard and open a Proton Mail
composer with the subject filled in. Paste into the message body with Ctrl+V or Cmd+V, add the
recipients and send. Proton must be in rich-text mode for the formatting to remain visible.
Screenshots go on as ordinary attachments.

Useful options:

```sh
# Choose an older release or another end ref.
npm run changelog -- --from v2026.08.21 --to main

# Keep the highlights somewhere else, e.g. to reuse a draft.
npm run changelog -- --notes /tmp/september-notes.md

# Customise the email identity and headline.
npm run changelog -- --product "On the Terrain" --title "The latest improvements"

# Include repository-only changes, choose an output path, or skip opening a browser.
npm run changelog -- --include-internal --out /tmp/update.html --no-open
```

Run `npm run changelog -- --help` for every option. Pull request links are added when the
`origin` remote is a GitHub repository; the email still renders without them. The detailed
list skips commits that only mean something to developers (refactors, review rounds, file
names); the preview is editable if one slips through.
