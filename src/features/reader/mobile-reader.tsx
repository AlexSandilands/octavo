"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { site } from "@/lib/site";
import { textSizeScale, type Block, type IssueContent } from "@/lib/blocks";
import type { ImageMap } from "@/lib/images";
import type { SponsorMap } from "@/lib/sponsors";
import { externalHref, richTextToHtml } from "@/lib/rich-text";
import { BlockImage } from "@/features/blocks/block-view";

// Mobile reader: the whole issue as one flowing column (also the accessibility
// fallback). Same block data as the flipbook, presented single-column.
export function MobileReader({
  content,
  images,
  sponsors,
}: {
  content: IssueContent;
  images: ImageMap;
  sponsors: SponsorMap;
}) {
  const [m, setM] = useState(19);
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
        <button
          ref={menuBtnRef}
          onClick={() => setDrawer(true)}
          className="text-ink flex h-10 w-10 items-center justify-center rounded-[9px]"
          aria-label="Contents"
        >
          <Icon name="menu" size={22} />
        </button>
        <span className="text-ink font-serif text-[17px] tracking-[0.02em]">
          {site.name}
        </span>
        <div className="border-line flex items-center overflow-hidden rounded-full border bg-[#f0ece2]">
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

// DOM id for a heading block, shared by the renderer and the contents drawer.
function headingDomId(blockId: string): string {
  return `heading-${blockId}`;
}

function MobileBlock({
  block,
  m,
  images,
  sponsors,
  cover,
}: {
  block: Block;
  m: number;
  images: ImageMap;
  sponsors: SponsorMap;
  cover?: boolean;
}) {
  switch (block.type) {
    case "heading": {
      const level = block.level ?? "main";
      // Paragraph sub-heads: small, bold, no kicker — distinct from body.
      if (!cover && level === "paragraph") {
        return (
          <h3
            className="text-ink mt-4 mb-1.5 font-serif font-semibold leading-snug"
            style={{ fontSize: m + 2 }}
          >
            {block.title}
          </h3>
        );
      }
      // main/cover get the largest type; section sits between it and the body.
      const fontSize = cover ? m + 22 : level === "section" ? m + 7 : m + 13;
      return (
        <div className={cover ? "mb-4" : "mb-3 mt-1"}>
          {block.kicker && (
            <div
              className={`text-accent mb-2 font-sans font-semibold uppercase ${
                cover
                  ? "text-[12px] tracking-[0.3em]"
                  : "text-[11px] tracking-[0.2em]"
              }`}
            >
              {block.kicker}
            </div>
          )}
          <h2
            id={headingDomId(block.id)}
            tabIndex={-1}
            className="text-ink scroll-mt-4 font-serif leading-[1.1]"
            style={{ fontSize }}
          >
            {block.title}
          </h2>
        </div>
      );
    }
    case "text":
      return cover ? (
        <p
          className="text-muted mb-3 font-serif whitespace-pre-line italic"
          style={{ fontSize: m + 2, lineHeight: 1.6 }}
        >
          {block.text}
        </p>
      ) : (
        <div
          className="text-body rich-text mb-4 font-serif"
          style={{ fontSize: m * textSizeScale(block.size), lineHeight: 1.62 }}
          dangerouslySetInnerHTML={{ __html: richTextToHtml(block.text) }}
        />
      );
    case "image": {
      const resolved = block.imageId ? images[block.imageId] : undefined;
      // Phones don't wrap text around floats (too cramped for the audience):
      // honour the chosen size and align the (smaller) image left/right/centre.
      const width = block.width ?? 100;
      const align = block.align ?? "full";
      const sized = width < 100;
      const alignClass = sized
        ? align === "left"
          ? "mr-auto"
          : align === "right"
            ? "ml-auto"
            : "mx-auto"
        : "";
      return (
        <figure
          className={`my-3 ${alignClass}`}
          style={sized ? { width: `${width}%` } : undefined}
        >
          {resolved ? (
            <BlockImage image={resolved} alt={block.alt || block.caption} />
          ) : (
            <div className="photo-fill flex h-[180px] items-center justify-center border border-[#e2dccf]">
              <span className="bg-page text-faint px-2 py-1 font-mono text-[11px]">
                {block.caption || "PHOTO"}
              </span>
            </div>
          )}
          {block.caption && (
            <figcaption
              className="text-faint mt-2 font-sans"
              style={{ fontSize: Math.max(12, m - 5), lineHeight: 1.4 }}
            >
              {block.caption}
            </figcaption>
          )}
        </figure>
      );
    }
    case "sponsor": {
      // Same v1→v2 resolution as BlockView: a managed block resolves from the
      // sponsors map; a version-1 or manual block falls back to inline fields; a
      // managed reference that no longer resolves (deleted) is hidden.
      const managed = block.sponsorId ? sponsors[block.sponsorId] : undefined;
      if (block.sponsorId && !managed) return null;
      const name = managed ? managed.name : block.name;
      const logo = managed?.logo ?? null;
      const link = externalHref((managed ? managed.href : block.href) ?? "");
      const card = (
        <div className="bg-tint my-4 flex items-center gap-3 rounded-md p-4">
          <div className="bg-card text-faint flex h-12 w-24 flex-none items-center justify-center overflow-hidden rounded font-mono text-[10px]">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo.url}
                alt={name ? `${name} logo` : "Sponsor logo"}
                className="h-full w-full object-contain"
              />
            ) : (
              "SPONSOR"
            )}
          </div>
          <div>
            <div className="text-accent-soft font-sans text-[9px] font-semibold tracking-[0.2em] uppercase">
              Sponsor
            </div>
            <div className="text-accent-ink font-sans text-base font-semibold">
              {name}
            </div>
            {link && (
              <div className="text-accent font-sans text-[13px] font-medium">
                Visit the store →
              </div>
            )}
          </div>
        </div>
      );
      return link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="block no-underline"
        >
          {card}
        </a>
      ) : (
        card
      );
    }
  }
}
