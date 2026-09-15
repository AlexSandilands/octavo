---
name: changelog
description: Write the client-facing release email. Runs `npm run changelog`, turns the drafted highlights into plain-English prose in the notes file, re-renders the preview. Use when asked for a changelog, release notes or the update email.
---

# Changelog email

1. Run `npm run changelog -- --no-open`. It reports the notes file under `.data/`
   (drafted on first run, kept after that) and the HTML preview.
2. Open the notes file. Each `## Headline` is a pull request; the comment beneath lists
   its inner commits. Rewrite every headline as one short plain sentence a club member
   would understand, ending in a full stop, and add one or two sentences beneath saying
   what it means for readers or the person editing the magazine. Match the tone of
   `docs/changelog-email.md`'s description: no jargon, no file or component names, no
   PR numbers. Merge PRs that are one feature from the reader's point of view (a fix
   that finishes a feature belongs with that feature); drop anything a client would not
   notice. Keep the section split: features under `# New features`, fixes under
   `# Fixes and improvements`. Read the PR diff or `git log -p` when a title alone is
   not enough to describe the change honestly.
3. Run `npm run changelog` again to render and open the preview, and tell the user
   which highlights you dropped or merged so they can restore any they want.
