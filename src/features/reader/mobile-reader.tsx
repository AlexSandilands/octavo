"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { site } from "@/lib/site";
import type { Block, IssueContent } from "@/lib/blocks";
import type { ImageMap } from "@/lib/images";
import { BlockImage } from "@/features/blocks/block-view";

// Mobile reader: the whole issue as one flowing column (also the accessibility
// fallback). Same block data as the flipbook, presented single-column.
export function MobileReader({
  content,
  images,
}: {
  content: IssueContent;
  images: ImageMap;
}) {
  const [m, setM] = useState(19);
  const [drawer, setDrawer] = useState(false);

  const blocks: Block[] = content.pages.flatMap((p) => p.blocks);
  const headings = blocks.filter(
    (b): b is Extract<Block, { type: "heading" }> =>
      b.type === "heading" && b.title.trim() !== "",
  );

  return (
    <div className="bg-page relative flex min-h-screen flex-col">
      <header className="border-line-soft bg-page flex h-[52px] flex-none items-center justify-between border-b px-4">
        <button
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
        {blocks.map((b) => (
          <MobileBlock key={b.id} block={b} m={m} images={images} />
        ))}
      </article>

      {drawer && (
        <>
          <div
            className="absolute inset-0 bg-[rgba(32,32,28,0.32)]"
            onClick={() => setDrawer(false)}
          />
          <div className="bg-card absolute top-0 bottom-0 left-0 flex w-[250px] flex-col py-6 shadow-[8px_0_30px_rgba(0,0,0,0.2)]">
            <div className="flex items-center justify-between px-5">
              <span className="text-accent font-sans text-[11px] font-semibold tracking-[0.2em] uppercase">
                In this issue
              </span>
              <button
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
                onClick={() => setDrawer(false)}
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

function MobileBlock({
  block,
  m,
  images,
}: {
  block: Block;
  m: number;
  images: ImageMap;
}) {
  switch (block.type) {
    case "heading":
      return (
        <div className="mb-3">
          {block.kicker && (
            <div className="text-accent mb-2 font-sans text-[11px] font-semibold tracking-[0.2em] uppercase">
              {block.kicker}
            </div>
          )}
          <h2
            className="text-ink font-serif leading-[1.1]"
            style={{ fontSize: m + 12 }}
          >
            {block.title}
          </h2>
        </div>
      );
    case "text":
      return (
        <p
          className="text-body mb-4 font-serif"
          style={{ fontSize: m, lineHeight: 1.62 }}
        >
          {block.text}
        </p>
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
            <BlockImage image={resolved} alt={block.caption} />
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
    case "sponsor":
      return (
        <div className="bg-tint my-4 flex items-center gap-3 rounded-md p-4">
          <div className="bg-card text-faint flex h-12 w-24 flex-none items-center justify-center rounded font-mono text-[10px]">
            SPONSOR
          </div>
          <div>
            <div className="text-accent-soft font-sans text-[9px] font-semibold tracking-[0.2em] uppercase">
              Sponsor
            </div>
            <div className="text-accent-ink font-sans text-base font-semibold">
              {block.name}
            </div>
          </div>
        </div>
      );
  }
}
