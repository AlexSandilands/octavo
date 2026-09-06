"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { Button, IconButton } from "@/components/ui";
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
import { MobileContents } from "./mobile-contents";
import { breakHeight, readerSections } from "./mobile-sections";
import { useIssuePdf } from "./use-issue-pdf";

// Header height, shared with the front cover's min-height below (#235).
const HEADER_HEIGHT = 56;
// The fixed bottom bar's height, reserved under the column so the last lines
// and the closing wordmark scroll clear of it.
const BAR_HEIGHT = 72;

type Heading = Extract<Block, { type: "heading" }>;

// Mobile reader: the whole issue as one flowing column (also the accessibility
// fallback). Same block data as the flipbook, presented single-column. The
// chrome lives here — a top bar with the way back, a fixed bottom bar with
// Contents, the text-size stepper and Download, the closing wordmark; the
// per-block rendering is mobile-block.tsx.
export function MobileReader({
  content,
  issueNo,
  title,
  logo,
  settings,
  images,
  sponsors,
}: {
  content: IssueContent;
  issueNo: number;
  /** The issue's title, for the top bar. */
  title: string;
  /** The issue's footer mark (issue #97), or null for no closing wordmark. */
  logo: ResolvedImage | null;
  /** The magazine's effective branding + footer appearance (issue #105). */
  settings: SiteSettings;
  images: ImageMap;
  sponsors: SponsorMap;
}) {
  const [m, setM] = useState(19);
  // Unconditional — hooks always are. Whether the button that uses it renders
  // is the owner's call (issue #162); see the bar below.
  const pdf = useIssuePdf(issueNo);
  const [contents, setContents] = useState(false);
  // A heading chosen from the contents sheet. The jump waits for the sheet to
  // unmount: DialogShell hands focus back to its trigger as it closes, and the
  // heading has to take it after that, not before.
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
    el.focus({ preventScroll: true });
  }, [contents]);

  const sections = readerSections(content.pages);
  const blocks: Block[] = sections.flatMap((s) => s.blocks);
  const headings = blocks.filter(
    (b): b is Heading =>
      b.type === "heading" &&
      b.title.trim() !== "" &&
      (b.level ?? "main") !== "paragraph",
  );

  const toTop = () => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  };

  return (
    <div className="bg-page relative flex min-h-dvh flex-col">
      <header
        style={{ height: HEADER_HEIGHT }}
        className="bg-surface border-hairline sticky top-0 z-20 flex flex-none items-center gap-1 border-b pr-4 pl-1"
      >
        <IconButton icon="arrowLeft" label="Back to the library" href="/" />
        <h1 className="text-fg min-w-0 flex-1 truncate font-ui text-[17px] font-bold">
          {title}
        </h1>
        <span className="text-fg-muted flex-none font-ui text-[14px] font-bold">
          No. {issueNo}
        </span>
      </header>

      <article
        className="page-content flex-1"
        style={{ paddingBottom: BAR_HEIGHT + 24 }}
      >
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
              {/* The page break: a band of canvas between two sheets of page. A
                  sibling of the section, not its first child, so it sits flush
                  against the page above whatever padding the page below has. */}
              {s.divided && (
                <div
                  aria-hidden
                  className="bg-canvas shadow-[inset_0_2px_3px_rgba(40,36,28,0.08)]"
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

        <div className="mt-10 flex justify-center px-5">
          <Button variant="secondary" icon="chevronUp" onClick={toTop}>
            Back to top
          </Button>
        </div>
      </article>

      <nav
        aria-label="Reader controls"
        className="bg-surface border-hairline fixed inset-x-0 bottom-0 z-20 flex items-stretch border-t px-2 pt-1 pb-[env(safe-area-inset-bottom,0px)]"
        style={{ minHeight: BAR_HEIGHT }}
      >
        <BarButton
          label="Contents"
          icon="menu"
          onClick={() => setContents(true)}
          expanded={contents}
        />
        <div
          role="group"
          aria-label="Text size"
          className="flex flex-1 flex-col items-center justify-center"
        >
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setM((v) => Math.max(16, v - 2))}
              disabled={m <= 16}
              aria-label="Smaller text"
              className="text-fg hover:bg-primary-wash hover:text-primary flex h-11 w-12 cursor-pointer items-center justify-center rounded-full font-ui text-[15px] font-bold transition-colors disabled:cursor-default disabled:opacity-40"
            >
              A−
            </button>
            <button
              type="button"
              onClick={() => setM((v) => Math.min(26, v + 2))}
              disabled={m >= 26}
              aria-label="Larger text"
              className="text-fg hover:bg-primary-wash hover:text-primary flex h-11 w-12 cursor-pointer items-center justify-center rounded-full font-ui text-[19px] font-bold transition-colors disabled:cursor-default disabled:opacity-40"
            >
              A+
            </button>
          </div>
          <span
            aria-hidden="true"
            className="text-fg-muted -mt-0.5 font-ui text-[12px] font-bold"
          >
            Text size
          </span>
        </div>
        {/* Dropped entirely when the owner has switched downloads off (#162). */}
        {settings.pdfDownloads && (
          <BarButton
            label={
              pdf.state === "loading"
                ? "Preparing…"
                : pdf.state === "error"
                  ? "Retry PDF"
                  : "Download"
            }
            ariaLabel={
              pdf.state === "loading"
                ? "Preparing PDF…"
                : pdf.state === "error"
                  ? "PDF failed — tap to retry"
                  : "Download PDF"
            }
            icon="download"
            busy={pdf.state === "loading"}
            danger={pdf.state === "error"}
            onClick={pdf.download}
          />
        )}
      </nav>

      {contents && (
        <MobileContents
          headings={headings}
          magazineName={settings.name}
          issueNo={issueNo}
          onClose={() => setContents(false)}
          onPick={(id) => {
            jump.current = id;
            setContents(false);
          }}
        />
      )}
    </div>
  );
}

// One cell of the bottom bar: a big icon over a label, the whole cell the
// target.
function BarButton({
  label,
  ariaLabel,
  icon,
  onClick,
  expanded,
  busy = false,
  danger = false,
}: {
  label: string;
  ariaLabel?: string;
  icon: "menu" | "download";
  onClick: () => void;
  expanded?: boolean;
  busy?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={ariaLabel}
      aria-expanded={expanded}
      aria-haspopup={expanded === undefined ? undefined : "dialog"}
      className={`flex flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-field font-ui text-[12px] font-bold transition-colors disabled:cursor-default ${
        danger ? "text-danger" : "text-fg hover:text-primary"
      }`}
    >
      <span
        className={`flex h-8 w-14 items-center justify-center rounded-full ${
          expanded ? "bg-primary-soft text-primary" : ""
        }`}
      >
        {busy ? (
          <span
            aria-hidden="true"
            className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
          />
        ) : (
          <Icon name={icon} size={24} strokeWidth={1.9} />
        )}
      </span>
      {label}
    </button>
  );
}
