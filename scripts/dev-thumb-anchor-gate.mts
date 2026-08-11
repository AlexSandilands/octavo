// Dev-only: proves the library thumbnail emits no anchors, *in memory* — no
// database, no dev server, no browser. Both library surfaces wrap CoverThumb in
// a card-sized <Link href="/read/…">, so any <a> a block renders inside it is an
// anchor nested in an anchor: invalid HTML the parser splits apart (hydration
// mismatch, and an inner link stealing part of the card's click area). Two block
// types can do it — a linked sponsor and a video's address line — so this
// renders one cover page carrying both through the two paths that matter and
// asserts they disagree in exactly the intended way:
//
//   - through CoverThumb (issue #166's `anchors={false}`): not one `<a`, while
//     the link *text* both blocks show is still on the page,
//   - through PageBlocks — the print/PDF document's renderer — the real anchors
//     are still there, because Chromium's page.pdf() builds the PDF's live link
//     annotations out of them (a verified acceptance criterion of #161),
//   - and BlockView called with no `anchors` prop at all still emits them, so
//     the new signal cannot silently become the default for the readers.
//
// Run: npx tsx --tsconfig scripts/tsconfig.json scripts/dev-thumb-anchor-gate.mts
//
// The `--tsconfig` is not optional and is why scripts/tsconfig.json exists: this
// is the first gate to *render* components, and the repo's tsconfig sets
// `jsx: "preserve"` (Next compiles JSX itself). esbuild, under tsx, reads that as
// the classic `React.createElement` transform and every component module then
// wants a global `React` that nothing outside Next provides. The override just
// says `react-jsx` for this run.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Page } from "../src/lib/blocks";
import type { SiteSettings } from "../src/lib/branding";
import { DEFAULT_FOOTER_STYLE } from "../src/lib/branding";
import { CoverThumb } from "../src/features/library/cover-thumb";
import { PageBlocks } from "../src/features/blocks/page-blocks";
import { BlockView } from "../src/features/blocks/block-view";
import { resolveTheme } from "../src/features/blocks/themes/registry";

const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
};

const VIDEO_ID = "dQw4w9WgXcQ";
const SPONSOR_HREF = "https://patron.example/shop";

// An inline (v1/manual) sponsor rather than a managed one on purpose: the
// thumbnail resolves no sponsors map, so a managed reference renders nothing
// there and would prove nothing. This is the shape that actually reaches it.
const page: Page = {
  id: "p1",
  cover: true,
  blocks: [
    { id: "b1", type: "heading", kicker: "Kicker", title: "Cover title" },
    {
      id: "b2",
      type: "video",
      provider: "youtube",
      videoId: VIDEO_ID,
      caption: "A video on the cover",
      align: "full",
      width: 100,
    },
    {
      id: "b3",
      type: "sponsor",
      name: "Patron & Co",
      href: SPONSOR_HREF,
    },
  ],
};

const settings: SiteSettings = {
  name: "The Magazine",
  org: "The Club",
  tagline: "",
  footer: DEFAULT_FOOTER_STYLE,
  pdfDownloads: false,
};

// Both layout themes draw the sponsor card differently (classic prints a "→",
// modern a "Visit the store" line); the anchor is BlockView's call, not theirs,
// so hold both to the same rule.
for (const theme of ["classic", "modern"]) {
  const thumb = renderToStaticMarkup(
    createElement(CoverThumb, {
      page,
      theme,
      images: {},
      issueNo: 1,
      settings,
      width: 150,
    }),
  );

  ok(
    !/<a[\s>]/.test(thumb),
    `[${theme}] the thumbnail renders no <a> at all (nothing to nest in the card's Link)`,
  );
  // …and not by dropping the content: the same information is on the page, as
  // text. A thumbnail that rendered neither block would pass the check above.
  ok(
    thumb.includes(`youtu.be/${VIDEO_ID}`),
    `[${theme}] …while the video's address is still shown, as text`,
  );
  ok(
    !thumb.includes(SPONSOR_HREF),
    `[${theme}] …and the sponsor's href appears nowhere in the markup`,
  );
  ok(
    thumb.includes("Patron &amp; Co"),
    `[${theme}] …while the sponsor card itself still renders`,
  );

  // The print path, unchanged: the PDF needs the real anchors.
  const print = renderToStaticMarkup(
    createElement(PageBlocks, {
      page,
      theme: resolveTheme(theme),
      images: {},
      sponsors: {},
    }),
  );
  ok(
    print.includes(`href="https://youtu.be/${VIDEO_ID}"`),
    `[${theme}] the print page keeps the video's link annotation anchor`,
  );
  ok(
    print.includes(`href="${SPONSOR_HREF}"`),
    `[${theme}] the print page keeps the sponsor's anchor`,
  );
}

// The default is "anchors allowed": every surface that does not opt out — the
// readers, the print document, the editor's own read-only paths — is untouched.
const bare = renderToStaticMarkup(
  createElement("div", null, [
    createElement(BlockView, {
      key: "v",
      block: page.blocks[1]!,
      theme: resolveTheme("classic"),
    }),
    createElement(BlockView, {
      key: "s",
      block: page.blocks[2]!,
      theme: resolveTheme("classic"),
    }),
  ]),
);
ok(
  bare.includes(`href="https://youtu.be/${VIDEO_ID}"`) &&
    bare.includes(`href="${SPONSOR_HREF}"`),
  "BlockView with no `anchors` prop still emits both anchors (opt-out, not opt-in)",
);

console.log("\nall checks passed");
