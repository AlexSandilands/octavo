// Index for `npm run db:seed`: assembles the six issues (one file each under
// ./seed/) into the list the runner inserts. Each issue is a visibly different
// magazine archetype so the demo shows the product's range — a long-form club
// quarterly, an image-led photo salon, a village newsletter, a long season
// review, a text-heavy essay and a maker's annual — split across both layout
// themes. Between them they exercise every block type, all three heading
// levels, every text size, cover pages, sponsor blocks with and without links,
// image wraps at a range of widths, and one deliberately legacy-shaped page
// (see issue-05). The images they reference are generated placeholder art:
// specs in ./seed/images.ts, renderers in ./seed/art.ts — no repo binaries.
import type { SeedIssue } from "./seed/builders";
import type { SeedImages } from "./seed/images";
import { issue01 } from "./seed/issue-01";
import { issue02 } from "./seed/issue-02";
import { issue03 } from "./seed/issue-03";
import { issue04 } from "./seed/issue-04";
import { issue05 } from "./seed/issue-05";
import { issue06 } from "./seed/issue-06";

export function buildIssues(img: SeedImages): SeedIssue[] {
  return [
    issue01(img),
    issue02(img),
    issue03(img),
    issue04(img),
    issue05(img),
    issue06(img),
  ];
}
