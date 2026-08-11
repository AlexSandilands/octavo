"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import type { SiteSettings } from "@/lib/branding";
import type { Block, IssueContent } from "@/lib/blocks";
import type { ImageMap, ResolvedImage } from "@/lib/images";
import type { SponsorMap } from "@/lib/sponsors";
import {
  LOCKUP_ALIGN,
  FooterWordmark,
  footerRow,
} from "@/features/blocks/page-footer";
import { headingDomId, MobileBlock } from "./mobile-block";
import { useIssuePdf } from "./use-issue-pdf";

// Mobile reader: the whole issue as one flowing column (also the accessibility
// fallback). Same block data as the flipbook, presented single-column. The
// chrome lives here — header, text-size control, contents drawer, the closing
// wordmark; the per-block rendering is mobile-block.tsx.
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
  const [drawer, setDrawer] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Contents drawer a11y (WCAG 2.1.2 / 2.4.3): on open, move focus into the
  // drawer; close on Escape; on close, return focus to the trigger button so
  // keyboard/screen-reader users aren't stranded at the top of the document.
  useEffect(() => {
    if (!drawer) return;
    const opener = menuBtnRef.current;
    closeBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawer(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      // Only restore focus if it was lost with the drawer (fell back to body) —
      // a TOC jump has already focused the target heading and must keep it.
      if (document.activeElement === document.body) opener?.focus();
    };
  }, [drawer]);

  // Jump to a heading from the contents drawer. Headings carry ids derived
  // from their block id (see MobileBlock) and are focused after the scroll so
  // screen-reader/keyboard users land where the page did.
  const goToHeading = (blockId: string) => {
    setDrawer(false);
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
  };

  const blocks: Block[] = content.pages.flatMap((p) => p.blocks);
  const headings = blocks.filter(
    (b): b is Extract<Block, { type: "heading" }> =>
      b.type === "heading" &&
      b.title.trim() !== "" &&
      (b.level ?? "main") !== "paragraph",
  );

  return (
    <div className="bg-page relative flex min-h-screen flex-col">
      <header className="border-line-soft bg-page flex h-[52px] flex-none items-center justify-between border-b px-4">
        <div className="flex items-center">
          <button
            ref={menuBtnRef}
            onClick={() => setDrawer(true)}
            className="text-ink flex h-10 w-10 items-center justify-center rounded-[9px]"
            aria-label="Contents"
          >
            <Icon name="menu" size={22} />
          </button>
          {/* Dropped entirely when the owner has switched downloads off (issue
              #162). The menu button is left alone in this div — the header's
              justify-between keeps the title centred either way. */}
          {settings.pdfDownloads && (
            <button
              onClick={pdf.download}
              disabled={pdf.state === "loading"}
              className="text-ink flex h-10 w-10 items-center justify-center rounded-[9px] disabled:cursor-default"
              aria-label={
                pdf.state === "loading"
                  ? "Preparing PDF…"
                  : pdf.state === "error"
                    ? "PDF failed — tap to retry"
                    : "Download PDF"
              }
            >
              {pdf.state === "loading" ? (
                <span
                  aria-hidden="true"
                  className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
                />
              ) : (
                <Icon
                  name="download"
                  size={20}
                  className={pdf.state === "error" ? "text-alert" : undefined}
                />
              )}
            </button>
          )}
        </div>
        <span className="text-ink font-serif text-[17px] tracking-[0.02em]">
          {settings.name}
        </span>
        <div className="border-line bg-chip-soft flex items-center overflow-hidden rounded-full border">
          <button
            onClick={() => setM((v) => Math.max(16, v - 2))}
            className="text-ink flex h-10 w-10 items-center justify-center font-sans text-sm font-medium"
            aria-label="Smaller text"
          >
            A−
          </button>
          <div className="bg-hair h-5 w-px" />
          <button
            onClick={() => setM((v) => Math.min(26, v + 2))}
            className="text-ink flex h-10 w-10 items-center justify-center font-sans text-lg font-semibold"
            aria-label="Larger text"
          >
            A+
          </button>
        </div>
      </header>

      <article className="flex-1 px-5 pt-6 pb-10">
        {content.pages.map((p) =>
          p.cover ? (
            <section
              key={p.id}
              className="border-line-soft mb-8 border-b py-8 text-center"
            >
              {p.blocks.map((b) => (
                <MobileBlock
                  key={b.id}
                  block={b}
                  m={m}
                  images={images}
                  sponsors={sponsors}
                  cover
                />
              ))}
            </section>
          ) : (
            p.blocks.map((b) => (
              <MobileBlock
                key={b.id}
                block={b}
                m={m}
                images={images}
                sponsors={sponsors}
              />
            ))
          ),
        )}

        {/* This reader has no pages, so it has no running footer to carry the
            mark. It closes with it once instead — the same lockup the printed
            page uses, minus the page number. Nothing renders when the issue has
            no logo, so an issue without one ends exactly as it did before. */}
        {logo && (
          <div
            className={`border-line-soft mt-10 border-t pt-5 ${footerRow(
              settings.footer.textSize,
            )} ${LOCKUP_ALIGN[settings.footer.align]}`}
          >
            <FooterWordmark
              logo={logo}
              org={settings.org}
              markSize={settings.footer.markSize}
            />
          </div>
        )}
      </article>

      {drawer && (
        <>
          <div
            className="absolute inset-0 bg-[rgba(32,32,28,0.32)]"
            onClick={() => setDrawer(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="In this issue"
            className="bg-card absolute top-0 bottom-0 left-0 flex w-[250px] flex-col py-6 shadow-[8px_0_30px_rgba(0,0,0,0.2)]"
          >
            <div className="flex items-center justify-between px-5">
              <span className="text-accent font-sans text-[11px] font-semibold tracking-[0.2em] uppercase">
                In this issue
              </span>
              <button
                ref={closeBtnRef}
                onClick={() => setDrawer(false)}
                className="text-muted"
                aria-label="Close"
              >
                <Icon name="close" size={20} strokeWidth={1.7} />
              </button>
            </div>
            <div className="bg-line mx-5 my-4 h-px" />
            <Link
              href="/"
              className="text-muted flex items-center gap-1.5 px-5 pb-3 font-sans text-[14px] font-medium"
            >
              <Icon name="chevronLeft" size={16} />
              Library
            </Link>
            {headings.map((h) => (
              <button
                key={h.id}
                onClick={() => goToHeading(h.id)}
                className="text-accent px-5 py-2.5 text-left font-serif text-[19px]"
              >
                {h.title}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
