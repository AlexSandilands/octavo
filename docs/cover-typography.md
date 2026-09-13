# Cover typography

Cover typography offers Newsreader, Hanken Grotesk and Roboto Condensed. Fonts
are self-hosted; [sources, licences and rebuild instructions](../src/app/fonts/README.md)
live beside their files. Newsreader offers Extra Light 200 through Extra Bold
800 (seven weights); Hanken Grotesk and Roboto Condensed offer Thin 100 through
Black 900 (nine each). Every face includes genuine italics and Māori macrons.
The menus offer four distinct presets: Extra Light 200, Regular 400, Semi Bold
600, and the heaviest weight (Extra Bold 800 for Newsreader, Black 900 for the
others), plus the separate inheritance/reset choice. All previously saved weights
remain supported and display their name without being changed.

A Story's **Headline font** and **Headline weight**, beneath Headline size,
apply to the story headlines. Supporting copy and the optional list heading
retain their own typography. Original restores the old Newsreader/Medium 500
appearance. Changing the font clamps any saved weight to its supported range.

The floating selected-text toolbar offers the same family and weight choices
in compact 30px selectors on the same row as Bold, Italic and Underline.
The inspector retains its full-size controls. Cover editing uses `pre-wrap`
instead of Tiptap’s `break-spaces`, so spaces at soft wraps do not push
right-aligned words inward; authored spaces and line breaks are preserved.
They show the effective font and weight at the cursor, including inherited values.
With highlighted words, a choice formats that range; with only a caret, it sets
the font for future typing without changing existing words. Opening a menu retains
the selection and pending typing marks, and choosing returns focus to the text.
**Inherit font** removes both inline font
and weight; **Inherit weight** removes just the weight. The current field supplies
the inherited typography, including when editing supporting copy or a sidebar
field. Bold lights up when every selected run has an effective weight of at
least 700, including chosen and inherited heavy weights. Choosing Regular or
Semi Bold turns it off. Clicking Bold off changes the selected words to Regular
400; clicking it on raises them to at least 700, preserving heavier runs in a
mixed selection. Ctrl/Cmd+B follows the same behavior. With just a caret, Bold
affects future typing. Changing
family preserves each selected run’s weight and emphasis, clamping each weight
separately if needed; mixed regular/bold passages keep that distinction. Italic,
underline, colour and shadow remain independent. Clear removes all inline marks.

Content v9 adds optional `headlineFont`/`headlineWeight` on Story elements and
`fontFamily`/`fontWeight` on the validated `coverPaint` mark. Font ids and weights
are bounded; arbitrary CSS is never stored. Clipboard HTML carries validated
`data-cover-font-family` and `data-cover-font-weight` attributes. Typography uses
the same content and local font declarations across the editor, reader, mobile,
thumbnails and PDF. Font changes share existing undo/redo and autosave.

Existing content is never rewritten. Omitted typography keeps the original
font declarations, so publishing this feature cannot change old glyphs or
line wrapping. Opt-in full-range aliases reuse the existing Newsreader files
and Hanken upright file; only Hanken italic and Roboto Condensed add files.
Seed issue 6 demonstrates all three choices; issue 5 retains the legacy page.

Run `scripts/check-cover-fonts.mts` for schema, renderer and in-memory seed
invariants, and `scripts/check-cover-fonts-browser.mts <base-url>` for editing,
selection/keyboard menus, save/reload, clipboard and reader/print surfaces.
`scripts/check-cover-font-caret-browser.mts <base-url>` verifies fonts before
first typing, cursor tracking, pending styles, selection formatting and persistence.
`scripts/check-cover-right-alignment.mts <base-url>` checks wrapped line endings
in the editor, reader and both print themes.
The existing cover colour and cover element gates remain applicable.

`check-cover-font-selection.mts` covers mixed-run family changes and partial
selections in memory. `check-cover-bold-rendering.mts` uses Chromium with the real
local faces to verify computed weights for both mark orders in shared reader
output and editor markup, including Regular + Bold and the heaviest weights.
