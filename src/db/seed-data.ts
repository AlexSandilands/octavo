// Index for `npm run db:seed`: assembles the six issues (one file each under
// ./seed/) into the list the runner inserts. Each issue is a visibly different
// magazine archetype so the demo shows the product's range — a long-form club
// quarterly, an image-led photo salon, a village newsletter, a long season
// review, a text-heavy essay and a maker's annual — split across both layout
// themes. Between them they exercise every block type, all three heading
// levels, every text size, cover pages, sponsor blocks with and without links,
// image wraps at a range of widths, a cross-fading montage and a fill-page plate
// (both issue-02), a fit-page plate (issue-04) and one deliberately
// legacy-shaped page (see issue-05). Issues 02, 04 and 06 have full-page
// illustrated covers with linked stories, custom typography and library logos;
// 01 and 05 retain their inset images; 03 keeps its text-only cover.
// The images they reference are generated placeholder art: specs in
// ./seed/images.ts, renderers in ./seed/art.ts — no repo binaries.
import type { SeedIssue } from "./seed/builders";
import type { SeedImages } from "./seed/images";
import { issue01 } from "./seed/issue-01";
import { issue02 } from "./seed/issue-02";
import { issue03 } from "./seed/issue-03";
import { issue04 } from "./seed/issue-04";
import { issue05 } from "./seed/issue-05";
import { withCoverElements } from "./seed/cover-elements";
import { issue06 } from "./seed/issue-06";

// File names retain their original fixture names; issue numbers set the display order.
export function buildIssues(img: SeedImages): SeedIssue[] {
  return [
    issue01(img),
    withCoverElements(issue02(img), img),
    issue03(img),
    withCoverElements(issue06(img), img),
    issue05(img),
    withCoverElements(issue04(img), img),
  ];
}
