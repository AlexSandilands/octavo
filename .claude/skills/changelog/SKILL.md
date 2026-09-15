---
name: changelog
description: Write the client-facing release email. Runs `npm run changelog`, turns the drafted highlights into a short, readable set of prose entries in the notes file, re-renders the preview. Use when asked for a changelog, release notes or the update email.
---

# Changelog email

1. Run `npm run changelog -- --no-open`. It reports the notes file under `.data/`
   (drafted on first run, kept after that) and the HTML preview.
2. Open the notes file. The draft has one `## Headline` per pull request with its inner
   commits in a comment. **That is raw material, not the shape of the email.** The
   highlights are for a club member or the magazine's editor, so:
   - **Group by feature, not by pull request.** Everything that touches one thing the
     reader would name (the PDF importer, cover text, member notes) becomes one entry.
     A follow-up, a fix, or a restriction belongs inside the entry it relates to as a
     sentence, never as its own headline. "PDF import" and "Disable PDF import on covers"
     are one entry whose prose says it works on interior pages.
   - **Aim for four to eight entries in total**, the biggest first. Anything that would
     not change how someone uses the magazine is left out of the highlights; the
     _Every change in detail_ list at the foot of the email still carries it.
   - **Headline = one short plain sentence** ending in a full stop, naming the thing
     the reader gets ("Full-page photos.", "Undo and redo."). Beneath it, one to three
     sentences on what it does and where to find it. No jargon, file names, component
     names or PR numbers. Read the diff or `git log -p` when a title is not enough to
     describe the change honestly.
   - Keep the split: features under `# New features`, fixes that a reader would have
     noticed under `# Fixes and improvements`. Delete the rest.
3. Run `npm run changelog` again to render and open the preview, and tell the user what
   you merged or left out of the highlights so they can restore any they want.
