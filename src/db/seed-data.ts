// Index for `npm run db:seed`: assembles the ten issues (one file each under
// ./seed/) into the list the runner inserts, and declares which /assets image
// backs each logical image. The issues tell one story across the seasons —
// Margaret the veteran, Daniel the newcomer she mentors, and the long saga of
// saving the far rink — and between them exercise every block type, all three
// heading levels, every text size, cover pages, and a wide range of image
// placements (full, wrapped left/right, banners, with and without captions).
import type { SeedImages, SeedIssue } from "./seed/builders";
import { issue01 } from "./seed/issue-01";
import { issue02 } from "./seed/issue-02";
import { issue03 } from "./seed/issue-03";
import { issue04 } from "./seed/issue-04";
import { issue05 } from "./seed/issue-05";
import { issue06 } from "./seed/issue-06";
import { issue07 } from "./seed/issue-07";
import { issue08 } from "./seed/issue-08";
import { issue09 } from "./seed/issue-09";
import { issue10 } from "./seed/issue-10";

export type { SeedImages } from "./seed/builders";

// Which /assets file backs each logical image, and its key in SeedImages.
export const SEED_ASSETS: { key: keyof SeedImages; file: string }[] = [
  { key: "boules", file: "4.jpg" },
  { key: "measure", file: "1.jpg" },
  { key: "terrain", file: "2.webp" },
  { key: "group", file: "3.webp" },
  { key: "building", file: "5.jpg" },
];

export function buildIssues(img: SeedImages): SeedIssue[] {
  return [
    issue01(img),
    issue02(img),
    issue03(img),
    issue04(img),
    issue05(img),
    issue06(img),
    issue07(img),
    issue08(img),
    issue09(img),
    issue10(img),
  ];
}
