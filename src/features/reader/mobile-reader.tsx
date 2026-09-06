"use client";

import { Fragment, useState } from "react";
import type { SiteSettings } from "@/lib/branding";
import type { Block, IssueContent } from "@/lib/blocks";
import type { ImageMap, ResolvedImage } from "@/lib/images";
import type { SponsorMap } from "@/lib/sponsors";
import {
  FOOTER_ROW_CLASS,
  LOCKUP_ALIGN,
  FooterWordmark,
  footerTextStyle,
} from "@/features/blocks/page-footer";
import { headingDomId, MobileBlock } from "./mobile-block";
import { MobileContents, MobileReaderBar } from "./mobile-reader-chrome";
import { breakHeight, readerSections } from "./mobile-sections";
import { useIssuePdf } from "./use-issue-pdf";

// Header height, shared with the front cover's min-height below (#235).
const HEADER_HEIGHT = 56;

type Heading = Extract<Block, { type: "heading" }>;

// Mobile reader: the whole issue as one flowing column (also the accessibility
// fallback). Same block data as the flipbook, presented single-column. The
// chrome lives here and in mobile-reader-chrome.tsx — the sticky bar, the
// contents list, the "Next:" links, the closing wordmark; the per-block
// rendering is mobile-block.tsx, and the column keeps the page's own paper.
export function MobileReader({
  content,
  issueNo,
  logo,
  settings,
  images,
  sponsors,
}: {
  content: IssueContent;
  issueNo: number;
  /** The issue's footer mark (issue #97), or null for no closing wordmark. */
  logo: ResolvedImage | null;
  /** The magazine's effective branding + footer appearance (issue #105). */
  settings: SiteSettings;
  images: ImageMap;
  sponsors: SponsorMap;
}) {
  const [m, setM] = useState(19);
  // Unconditional — hooks always are. Whether the button that uses it renders
  // is the owner's call (issue #162); see the bar.
  const pdf = useIssuePdf(issueNo);
  const [contents, setContents] = useState(false);

  // Jump to a heading. Headings carry ids derived from their block id (see
  // MobileBlock) and are focused after the scroll so screen-reader/keyboard
  // users land where the page did. Deferred a frame so it runs after the
  // contents dialog has unmounted and handed focus back to its trigger.
  const goToHeading = (blockId: string) => {
    setContents(false);
    requestAnimationFrame(() => {
      const el = document.getElementById(headingDomId(blockId));
      if (!el) return;
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      el.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
      el.focus({ preventScroll: true });
    });
  };

  const sections = readerSections(content.pages);
  const isHeading = (b: Block): b is Heading =>
    b.type === "heading" &&
    b.title.trim() !== "" &&
    (b.level ?? "main") !== "paragraph";
  const headings = sections.flatMap((s) => s.blocks).filter(isHeading);
  // The first heading of each section names it for the "Next:" links.
  const sectionHeading = sections.map((s) => s.blocks.find(isHeading) ?? null);

  return (
    <div className="bg-page relative flex min-h-screen flex-col">
      <MobileReaderBar
        height={HEADER_HEIGHT}
        onContents={() => setContents(true)}
        onSmaller={() => setM((v) => Math.max(16, v - 2))}
        onLarger={() => setM((v) => Math.min(26, v + 2))}
        pdfEnabled={settings.pdfDownloads}
        pdfState={pdf.state}
        onDownloadPdf={pdf.download}
      />

      <article className="flex-1 pb-10">
        {sections.map((s, i) => {
          // The front cover fills what's left of the viewport under the bar
          // (and grows past it rather than clipping); other covers keep their
          // content height.
          const front = i === 0 && s.cover;
          const body = s.blocks.map((b) => (
            <MobileBlock
              key={b.id}
              block={b}
              m={m}
              images={images}
              sponsors={sponsors}
              cover={s.cover}
            />
          ));
          // The section that follows, when it has a heading to name it.
          const next = sectionHeading
            .slice(i + 1)
            .find((h): h is Heading => h !== null);
          return (
            <Fragment key={s.id}>
              {/* The page break: a band of newsprint under a heavy rule between
                  two sheets of page. A sibling of the section, not its first
                  child, so it sits flush against the page above whatever
                  padding the page below has. */}
              {s.divided && (
                <div
                  aria-hidden
                  className="bg-newsprint border-lead border-t-[3px]"
                  style={{ height: breakHeight(m) }}
                />
              )}
              <section
                style={
                  front
                    ? { minHeight: `calc(100dvh - ${HEADER_HEIGHT}px)` }
                    : undefined
                }
                // The space under the break is the next page's own top padding;
                // a page owned by a photo has none, so the photo runs from the
                // break above it to the one below.
                className={[
                  "px-5",
                  !s.filled && !s.cover && (i === 0 || s.divided) && "pt-6",
                  !s.filled &&
                    (i === sections.length - 1 || sections[i + 1]?.divided) &&
                    "pb-8",
                  s.cover && "py-8 text-center",
                  front && "flex flex-col justify-center",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {/* One flex child, so centring the cover leaves the blocks' own
                    collapsed margins alone. */}
                {front ? <div>{body}</div> : body}
                {/* A way on: the next section by name, once this one is read.
                    Only where a page break follows, so a section that runs on
                    across pages isn't interrupted. */}
                {next && !s.filled && sections[i + 1]?.divided && (
                  <p className="mt-6">
                    <button
                      type="button"
                      onClick={() => goToHeading(next.id)}
                      className="text-red inline-flex min-h-11 cursor-pointer items-center font-ui text-[16px] font-semibold underline decoration-1 underline-offset-4"
                    >
                      Next: {next.title} →
                    </button>
                  </p>
                )}
              </section>
            </Fragment>
          );
        })}

        {/* This reader has no pages, so it has no running footer to carry the
            mark. It closes with it once instead — the same lockup the printed
            page uses, minus the page number. Nothing renders when the issue has
            no logo, so an issue without one ends exactly as it did before. */}
        {logo && (
          <div
            style={footerTextStyle(settings.footer.textSize)}
            className={`mt-8 px-5 ${FOOTER_ROW_CLASS} ${LOCKUP_ALIGN[settings.footer.align]}`}
          >
            <FooterWordmark
              logo={logo}
              org={settings.org}
              markSize={settings.footer.markSize}
            />
          </div>
        )}

        <p className="border-lead mx-5 mt-10 border-t-[3px] pt-4">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({
                top: 0,
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                  .matches
                  ? "auto"
                  : "smooth",
              });
            }}
            className="text-lead inline-flex min-h-11 items-center font-ui text-[16px] font-semibold underline decoration-1 underline-offset-4"
          >
            ↑ Back to top
          </a>
        </p>
      </article>

      {contents && (
        <MobileContents
          headings={headings.map((h) => ({ id: h.id, title: h.title }))}
          onGo={goToHeading}
          onClose={() => setContents(false)}
        />
      )}
    </div>
  );
}
