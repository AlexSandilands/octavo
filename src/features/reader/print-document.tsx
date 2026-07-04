import type { IssueContent } from "@/lib/blocks";
import type { ImageMap } from "@/lib/images";
import type { SponsorMap } from "@/lib/sponsors";
import { type Theme } from "@/features/blocks/block-view";
import { PageBlocks } from "@/features/blocks/page-blocks";
import { PageFrame, PAGE_W, PAGE_H } from "@/features/blocks/page-frame";

// The print/PDF document: every page of the issue rendered once, in order, at
// full PAGE_W×PAGE_H canvas size (no ScaledPage — Chromium prints the canvas
// 1:1). Server-rendered and only ever loaded by the generator over localhost.
// One `.pdf-page` box per magazine page; each box equals the PDF page size the
// generator sets, so the output is one PDF page per magazine page, matching the
// flipbook page-for-page.

// The stored theme is a lowercase string ("classic"/"modern"); the renderer
// speaks the capitalised Theme union. Default to Classic (the reader's default)
// so the PDF matches what a member opens by default.
function normaliseTheme(theme: string): Theme {
  return theme.toLowerCase() === "modern" ? "Modern" : "Classic";
}

// Sheet sizing + page breaks. Print-color-adjust keeps the paper wash, page
// borders and sponsor tints in the print snapshot (paired with Playwright's
// printBackground). @page matches the canvas so there is no default margin.
// The pages live in their own wrapper (`.pdf-pages`) because Next streams
// <script>/<template> elements after the page content in <body> — as direct
// body children the last page would never be :last-child, its break-after
// would stick, and the PDF would end on a blank page.
const PRINT_CSS = `
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; padding: 0; background: #fff; }
  @page { size: ${PAGE_W}px ${PAGE_H}px; margin: 0; }
  .pdf-page { width: ${PAGE_W}px; height: ${PAGE_H}px; overflow: hidden; break-after: page; }
  .pdf-pages > .pdf-page:last-child { break-after: auto; }
`;

export function PrintDocument({
  content,
  issueNo,
  theme,
  images,
  sponsors,
}: {
  content: IssueContent;
  issueNo: number;
  theme: string;
  images: ImageMap;
  sponsors: SponsorMap;
}) {
  const t = normaliseTheme(theme);
  return (
    <div className="pdf-pages">
      <style>{PRINT_CSS}</style>
      {content.pages.map((page, i) => {
        const pageNo = i + 1;
        // Mirror the reader's spread parity so the classic spine seam and the
        // running footer land on the correct edge: page 1 (cover) is a right
        // leaf, then even pages sit left and odd pages right.
        const side = pageNo % 2 === 0 ? "left" : "right";
        return (
          <div key={page.id} className="pdf-page">
            <PageFrame
              theme={t}
              w={PAGE_W}
              h={PAGE_H}
              issueNo={issueNo}
              pageNo={pageNo}
              side={side}
            >
              <PageBlocks
                page={page}
                theme={t}
                images={images}
                sponsors={sponsors}
              />
            </PageFrame>
          </div>
        );
      })}
    </div>
  );
}
