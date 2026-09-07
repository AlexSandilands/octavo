"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { DialogShell } from "@/components/dialog-shell";
import { Icon } from "@/components/icons";
import { Button, IconButton, Label } from "@/components/ui";
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
import { breakHeight, readerSections } from "./mobile-sections";
import { useIssuePdf } from "./use-issue-pdf";

// Header height, shared with the front cover's min-height below (#235).
const HEADER_HEIGHT = 56;

// Mobile reader: the whole issue as one flowing column (also the accessibility
// fallback). Same block data as the flipbook, presented single-column as a
// sheet of page on the dark ground. The chrome lives here — the bar, the
// text-size control, the contents sheet, the closing band; the per-block
// rendering is mobile-block.tsx.
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
  // is the owner's call (issue #162); see the header below.
  const pdf = useIssuePdf(issueNo);
  const [contents, setContents] = useState(false);
  // A heading chosen from the contents sheet, jumped to once the sheet has
  // gone: the shell hands focus back to the button that opened it as it
  // unmounts, so the heading is focused after that, not before. A ref, not
  // state — it is read once by the effect below and never rendered.
  const jump = useRef<string | null>(null);

  useEffect(() => {
    if (contents || !jump.current) return;
    const el = document.getElementById(headingDomId(jump.current));
    jump.current = null;
    if (!el) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    el.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
    // Headings carry ids derived from their block id (see MobileBlock) and are
    // focused after the scroll so screen-reader/keyboard users land where the
    // page did.
    el.focus({ preventScroll: true });
  }, [contents]);

  const goToHeading = (blockId: string) => {
    jump.current = blockId;
    setContents(false);
  };

  const sections = readerSections(content.pages);
  const blocks: Block[] = sections.flatMap((s) => s.blocks);
  const headings = blocks.filter(
    (b): b is Extract<Block, { type: "heading" }> =>
      b.type === "heading" &&
      b.title.trim() !== "" &&
      (b.level ?? "main") !== "paragraph",
  );

  const pdfLabel =
    pdf.state === "loading"
      ? "Preparing PDF…"
      : pdf.state === "error"
        ? "PDF failed — tap to retry"
        : "Download PDF";

  return (
    <div className="bg-ground relative flex min-h-screen flex-col">
      <header
        style={{ height: HEADER_HEIGHT }}
        className="border-hairline bg-raised sticky top-0 z-10 flex flex-none items-center justify-between gap-2 border-b px-2"
      >
        <div className="flex items-center">
          <IconButton
            icon="menu"
            label="Contents"
            tone="dark"
            size={22}
            aria-expanded={contents}
            onClick={() => setContents(true)}
          />
          {/* Dropped entirely when the owner has switched downloads off (issue
              #162). The menu button is left alone in this div — the header's
              justify-between keeps the title centred either way. */}
          {settings.pdfDownloads && (
            <IconButton
              icon="download"
              label={pdfLabel}
              tone="dark"
              size={21}
              disabled={pdf.state === "loading"}
              onClick={pdf.download}
              className={pdf.state === "error" ? "text-danger-bright" : ""}
            />
          )}
        </div>
        <span className="text-chrome-text min-w-0 truncate font-display text-[17px]">
          {settings.name}
        </span>
        <div
          role="group"
          aria-label="Text size"
          className="border-hairline bg-lifted flex flex-none items-center overflow-hidden rounded-[7px] border"
        >
          <button
            type="button"
            onClick={() => setM((v) => Math.max(16, v - 2))}
            className="text-chrome-text hover:bg-chrome-soft flex h-11 w-11 cursor-pointer items-center justify-center font-ui text-[14px] font-medium"
            aria-label="Smaller text"
          >
            A−
          </button>
          <div className="bg-hairline h-6 w-px" />
          <button
            type="button"
            onClick={() => setM((v) => Math.min(26, v + 2))}
            className="text-chrome-text hover:bg-chrome-soft flex h-11 w-11 cursor-pointer items-center justify-center font-ui text-[18px] font-semibold"
            aria-label="Larger text"
          >
            A+
          </button>
        </div>
      </header>

      {/* The sheet: page-coloured, and pinned to the page faces (`page-env`) so
          the chrome's own type never reaches the authored content. Held to a
          reading measure, so on a tablet the dark ground shows either side. */}
      <article className="page-env bg-page mx-auto w-full max-w-2xl flex-1 pb-10">
        {sections.map((s, i) => {
          // The front cover fills what's left of the viewport under the header
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
          return (
            <Fragment key={s.id}>
              {/* The page break: a band of the dark ground between two sheets
                  of page. A sibling of the section, not its first child, so it
                  sits flush against the page above whatever padding the page
                  below has. */}
              {s.divided && (
                <div
                  aria-hidden
                  className="bg-ground"
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
      </article>

      {/* The closing band: the issue is over, and the way back is right here
          rather than a scroll away at the top. */}
      <div className="px-5 py-12 text-center">
        <Label tone="dark">End of issue</Label>
        <div className="mt-5 flex justify-center">
          <Button
            href="/"
            variant="secondary"
            tone="dark"
            icon="arrowLeft"
            iconPosition="left"
          >
            Back to the library
          </Button>
        </div>
      </div>

      {contents && (
        <DialogShell
          layout="full"
          panelClassName="on-dark bg-ground flex h-full w-full flex-col overflow-y-auto px-5 py-2"
          onClose={() => setContents(false)}
        >
          {(titleId) => (
            <>
              <div className="flex h-14 flex-none items-center justify-between">
                <h2
                  id={titleId}
                  className="text-brass font-meta text-[12px] font-medium tracking-[0.14em] uppercase"
                >
                  In this issue
                </h2>
                <IconButton
                  icon="close"
                  label="Close"
                  showLabel
                  tone="dark"
                  onClick={() => setContents(false)}
                />
              </div>
              <p className="text-chrome-muted font-meta text-[12px] tracking-[0.1em] uppercase">
                {settings.name} · No. {issueNo}
              </p>
              <nav className="mt-4 flex flex-col">
                {headings.length === 0 && (
                  <p className="text-chrome-muted py-4 font-ui text-[16px]">
                    Headings appear here.
                  </p>
                )}
                {headings.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => goToHeading(h.id)}
                    className="border-hairline text-chrome-text hover:bg-lifted rounded-ui flex min-h-14 w-full cursor-pointer items-center gap-3 border-b px-2 py-3 text-left font-display text-[20px] leading-snug"
                  >
                    <Icon
                      name="chevronRight"
                      size={18}
                      className="text-brass flex-none"
                    />
                    {h.title}
                  </button>
                ))}
              </nav>
              <div className="border-hairline mt-auto border-t py-5">
                <Button
                  href="/"
                  variant="ghost"
                  tone="dark"
                  icon="arrowLeft"
                  iconPosition="left"
                >
                  Back to the library
                </Button>
              </div>
            </>
          )}
        </DialogShell>
      )}
    </div>
  );
}
