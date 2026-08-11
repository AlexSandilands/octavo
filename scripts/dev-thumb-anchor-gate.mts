// Dev-only: proves the library thumbnail draws the whole cover page and emits
// no anchors doing it, *in memory* — no database, no dev server, no browser.
//
// Both library surfaces wrap CoverThumb in a card-sized <Link href="/read/…">,
// so any <a> a block renders inside it is an anchor nested in an anchor:
// invalid HTML the parser splits apart (hydration mismatch, and an inner link
// stealing part of the card's click area). Two block types can do it — a linked
// sponsor and a video's address line. The failure mode on the other side is
// quieter: a *managed* sponsor block (content v2) stores only a `sponsorId`, and
// BlockView renders a reference it cannot resolve as nothing at all, so a
// thumbnail handed no sponsors map dropped the block silently (issue #170).
// Suppressing the link and suppressing the block look identical if you only
// count anchors, which is why every check below is paired.
//
// So: one cover page carrying an inline sponsor, a managed sponsor and a video,
// rendered through the paths that matter and asserted to disagree in exactly
// the intended ways:
//
//   - through CoverThumb (issue #166's `anchors={false}`): not one `<a`, while
//     the link *text* every block shows is still on the page — including the
//     managed sponsor's resolved name (#170),
//   - through CoverThumb with an *empty* map: the managed sponsor is gone and
//     the rest of the page is not, because hiding a deleted sponsor is
//     deliberate — a removed sponsor must not keep advertising,
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
import type { SponsorMap } from "../src/lib/sponsors";
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
const MANAGED_ID = "sponsor-1";
const MANAGED_NAME = "Managed Patron";
const MANAGED_HREF = "https://managed.example/patron";

// Both sponsor shapes on one page: the inline (v1/manual) block that carries its
// own name and href, and the managed (v2) block that carries only an id and is
// nothing without the map below.
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
    { id: "b4", type: "sponsor", sponsorId: MANAGED_ID, name: "" },
  ],
};

// What the server resolves out of the sponsors table for that reference.
const sponsors: SponsorMap = {
  [MANAGED_ID]: { name: MANAGED_NAME, href: MANAGED_HREF, logo: null },
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
  const thumbOf = (map: SponsorMap) =>
    renderToStaticMarkup(
      createElement(CoverThumb, {
        page,
        theme,
        images: {},
        sponsors: map,
        issueNo: 1,
        settings,
        width: 150,
      }),
    );
  const thumb = thumbOf(sponsors);

  ok(
    !/<a[\s>]/.test(thumb),
    `[${theme}] the thumbnail renders no <a> at all (nothing to nest in the card's Link)`,
  );
  // …and not by dropping the content: the same information is on the page, as
  // text. A thumbnail that rendered no blocks would pass the check above.
  ok(
    thumb.includes(`youtu.be/${VIDEO_ID}`),
    `[${theme}] …while the video's address is still shown, as text`,
  );
  ok(
    !thumb.includes(SPONSOR_HREF) && !thumb.includes(MANAGED_HREF),
    `[${theme}] …and neither sponsor's href appears anywhere in the markup`,
  );
  ok(
    thumb.includes("Patron &amp; Co"),
    `[${theme}] …while the inline sponsor card itself still renders`,
  );
  // Issue #170: the managed reference is only a `sponsorId` in the document, so
  // its name reaching the markup is proof the map was threaded all the way down.
  ok(
    thumb.includes(MANAGED_NAME),
    `[${theme}] …and the managed sponsor renders its resolved name too`,
  );

  // The deliberate hiding, still deliberate: with no entry for the id (the
  // sponsor was deleted) the slot goes away — and takes nothing else with it.
  const orphaned = thumbOf({});
  ok(
    !orphaned.includes(MANAGED_NAME),
    `[${theme}] an unresolved managed sponsor stays hidden (deleted ≠ shown blank)`,
  );
  ok(
    orphaned.includes("Patron &amp; Co") &&
      orphaned.includes(`youtu.be/${VIDEO_ID}`),
    `[${theme}] …while the rest of the cover is untouched by the missing entry`,
  );

  // The print path, unchanged: the PDF needs the real anchors, from both shapes.
  const print = renderToStaticMarkup(
    createElement(PageBlocks, {
      page,
      theme: resolveTheme(theme),
      images: {},
      sponsors,
    }),
  );
  ok(
    print.includes(`href="https://youtu.be/${VIDEO_ID}"`),
    `[${theme}] the print page keeps the video's link annotation anchor`,
  );
  ok(
    print.includes(`href="${SPONSOR_HREF}"`),
    `[${theme}] the print page keeps the inline sponsor's anchor`,
  );
  ok(
    print.includes(`href="${MANAGED_HREF}"`),
    `[${theme}] the print page keeps the managed sponsor's anchor`,
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
