import Image from "next/image";
import { textSizePx, type Block, type BlockPatch } from "@/lib/blocks";
import type { ImageMap, ResolvedImage } from "@/lib/images";
import { externalHref, richTextToHtml } from "@/lib/rich-text";
import { Editable } from "./editable";

export type Theme = "Classic" | "Modern";

// A resolved image, scaled to its container width at its natural aspect ratio.
// next/image needs intrinsic dimensions; older records may lack them, so fall
// back to a plain <img> in that case. Shared by the editor and both readers.
//
// `unoptimized` on purpose (issue #6): the upload pipeline already emits final,
// capped-2000px WebP, so re-optimising through /_next/image would only move the
// bytes and CPU onto the Railway container — the exact cost R2 exists to avoid.
// With it off, next/image emits the R2 public URL directly (edge-cached by
// Cloudflare, zero Railway egress) while keeping the width/height/sizes layout
// and lazy-loading behaviour. In dev the same path serves the local /api/images
// fallback unchanged.
export function BlockImage({
  image,
  alt,
}: {
  image: ResolvedImage;
  alt: string;
}) {
  if (image.width && image.height) {
    return (
      <Image
        src={image.url}
        alt={alt}
        width={image.width}
        height={image.height}
        sizes="(max-width: 768px) 100vw, 480px"
        className="h-auto w-full"
        unoptimized
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={image.url} alt={alt} className="h-auto w-full" />;
}

// How a block's editable fields are written back. When present, BlockView
// renders its text in-place editable (admin editor); when absent, it renders
// read-only (reader / PDF). One renderer → the editor looks exactly like the
// reader, the only difference being you can click the text and type.
export type BlockEditHandlers = {
  onChange: (patch: BlockPatch) => void;
};

// Read-only OR editable themed rendering of one block. Shared by the desktop
// reader and the admin editor. Body text scales with `textSize` (the A−/A+
// control); headings/captions stay fixed.
export function BlockView({
  block,
  theme,
  edit,
  images,
  variant,
}: {
  block: Block;
  theme: Theme;
  edit?: BlockEditHandlers;
  /** imageId → resolved R2 image; absent ids render as the photo placeholder. */
  images?: ImageMap;
  /** "cover" switches headings/text to the oversized, centred cover treatment. */
  variant?: "cover";
}) {
  const classic = theme === "Classic";

  // A text field: editable in place when `edit` is set, otherwise the raw
  // text. The caller supplies the patch shape, so writes stay typed per block.
  const f = (
    patch: (v: string) => BlockPatch,
    value: string,
    placeholder: string,
  ) =>
    edit ? (
      <Editable
        value={value}
        placeholder={placeholder}
        onChange={(v) => edit.onChange(patch(v))}
      />
    ) : (
      value
    );

  // Cover pages render headings and body text much larger and centred; images
  // and sponsors fall through to the normal rendering (already centred, and
  // sized/centred by `blockFlowStyle`'s cover branch).
  if (variant === "cover") {
    if (block.type === "heading") {
      return (
        <div className="text-center">
          {(edit || block.kicker) && (
            <div className="text-accent font-sans text-[12px] font-semibold tracking-[0.34em] uppercase">
              {f((v) => ({ kicker: v }), block.kicker, "Masthead")}
            </div>
          )}
          <div
            className="text-ink mt-5 font-serif leading-[1.03]"
            style={{ fontSize: 68 }}
          >
            {f((v) => ({ title: v }), block.title, "Cover title")}
          </div>
          <div className="mt-7 flex items-center justify-center gap-3">
            <div className="h-px w-16 bg-[#cfc6b4]" />
            <div className="bg-accent h-1.5 w-1.5 rotate-45" />
            <div className="h-px w-16 bg-[#cfc6b4]" />
          </div>
        </div>
      );
    }
    if (block.type === "text") {
      return (
        <p className="text-muted text-center font-serif text-[24px] leading-relaxed whitespace-pre-line italic">
          {f((v) => ({ text: v }), block.text, "Add a tagline or date…")}
        </p>
      );
    }
  }

  switch (block.type) {
    case "heading": {
      const level = block.level ?? "main";
      // Kicker (eyebrow) sits above main/section titles; paragraph sub-heads
      // omit it. One element, themed, reused across the levels below.
      const kicker = (edit || block.kicker) && level !== "paragraph" && (
        <div
          className={
            classic
              ? "text-accent font-serif text-[13px] italic"
              : "text-accent font-sans text-[10px] font-semibold tracking-[0.2em] uppercase"
          }
        >
          {f((v) => ({ kicker: v }), block.kicker, "Kicker")}
        </div>
      );

      // Small run-in sub-head — themed but level-agnostic in layout.
      if (level === "paragraph") {
        return (
          <div
            className={
              classic
                ? "text-ink font-serif text-[15px] leading-snug font-semibold"
                : "text-accent font-sans text-[12px] font-semibold tracking-[0.08em] uppercase"
            }
          >
            {f((v) => ({ title: v }), block.title, "Sub-heading")}
          </div>
        );
      }

      if (classic) {
        return level === "section" ? (
          <div className="border-t border-[#e0d9c9] pt-3.5">
            {kicker}
            <div className="text-ink font-serif text-[24px] leading-tight">
              {f((v) => ({ title: v }), block.title, "Section heading")}
            </div>
          </div>
        ) : (
          <div className="text-center">
            {kicker}
            <div className="text-ink mt-1.5 font-serif text-[32px] leading-tight">
              {f((v) => ({ title: v }), block.title, "Heading")}
            </div>
            <div className="mt-3 flex items-center justify-center gap-2.5">
              <div className="h-px w-10 bg-[#cfc6b4]" />
              <div className="bg-accent h-1 w-1 rotate-45" />
              <div className="h-px w-10 bg-[#cfc6b4]" />
            </div>
          </div>
        );
      }

      return level === "section" ? (
        <div className="border-accent border-t-[2px] pt-2.5">
          {kicker}
          <div className="text-ink mt-1 font-serif text-[24px] leading-tight tracking-tight">
            {f((v) => ({ title: v }), block.title, "Section heading")}
          </div>
        </div>
      ) : (
        <div className="border-accent border-t-[3px] pt-3">
          {kicker}
          <div className="text-ink mt-2.5 font-serif text-[32px] leading-none tracking-tight">
            {f((v) => ({ title: v }), block.title, "Heading")}
          </div>
        </div>
      );
    }

    case "text":
      // Body text is authored as constrained rich HTML in the editor (see
      // RichTextEditor); here it renders read-only, sanitised. Editing this
      // block goes through RichTextEditor in editor-block.tsx, not `f()`.
      return (
        <div
          className="text-body font-serif rich-text"
          style={{ fontSize: textSizePx(block.size), lineHeight: 1.62 }}
          dangerouslySetInnerHTML={{ __html: richTextToHtml(block.text) }}
        />
      );

    case "image": {
      const resolved = block.imageId ? images?.[block.imageId] : undefined;
      const photo = resolved ? (
        <BlockImage image={resolved} alt={block.caption} />
      ) : classic ? (
        <div className="photo-fill flex h-[150px] items-center justify-center border border-[#e2dccf]">
          <span className="bg-page text-faint px-2 py-1 font-mono text-[11px]">
            {block.caption || "PHOTO"}
          </span>
        </div>
      ) : (
        <div className="photo-fill-green flex h-[150px] items-center justify-center">
          <span className="text-cream bg-[rgba(20,40,30,0.4)] px-2 py-1 font-mono text-[11px]">
            {block.caption || "PHOTO"}
          </span>
        </div>
      );
      return classic ? (
        <figure>
          {photo}
          {(edit || block.caption) && (
            <figcaption className="text-muted mt-2.5 text-center font-serif text-sm italic">
              {f((v) => ({ caption: v }), block.caption, "Caption (optional)")}
            </figcaption>
          )}
        </figure>
      ) : (
        <figure>
          {photo}
          {(edit || block.caption) && (
            <figcaption className="mt-2.5 flex items-start gap-2.5">
              <div className="bg-accent h-7 w-[3px] flex-none" />
              <span className="text-muted font-sans text-[13px] leading-snug">
                {f(
                  (v) => ({ caption: v }),
                  block.caption,
                  "Caption (optional)",
                )}
              </span>
            </figcaption>
          )}
        </figure>
      );
    }

    case "sponsor": {
      // Read-only: if the sponsor has a (validated) link, the whole card is the
      // anchor so members can tap it. In the editor the href is an editable
      // field instead, so we never wrap it in a link there.
      const link = edit ? null : externalHref(block.href ?? "");
      const card = classic ? (
        <div className="border-hair border p-5 text-center">
          <div className="text-faint2 font-sans text-[9px] font-semibold tracking-[0.24em] uppercase">
            With thanks to our patron
          </div>
          <div className="mx-auto mt-3.5 flex h-12 w-40 items-center justify-center border border-dashed border-[#c9c1b1] font-mono text-[10px] text-[#8a857b]">
            {block.logoId ? "LOGO" : "SPONSOR LOGO"}
          </div>
          <div className="text-accent mt-3 font-serif text-sm italic">
            {f((v) => ({ name: v }), block.name, "Sponsor name")} {link && "→"}
          </div>
          {edit && (
            <div className="text-accent mt-1 font-sans text-[12px]">
              {f(
                (v) => ({ href: v }),
                block.href ?? "",
                "https://link (optional)",
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-tint flex items-center gap-4 rounded-md p-4">
          <div className="bg-card text-faint flex h-12 w-28 flex-none items-center justify-center rounded font-mono text-[10px]">
            {block.logoId ? "LOGO" : "SPONSOR LOGO"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-accent-soft font-sans text-[9px] font-semibold tracking-[0.2em] uppercase">
              Sponsor
            </div>
            <div className="text-accent-ink mt-1 font-sans text-base font-semibold">
              {f((v) => ({ name: v }), block.name, "Sponsor name")}
            </div>
            {edit ? (
              <div className="text-accent mt-1 font-sans text-[13px]">
                {f(
                  (v) => ({ href: v }),
                  block.href ?? "",
                  "https://link (optional)",
                )}
              </div>
            ) : (
              link && (
                <div className="text-accent mt-1 font-sans text-[13px] font-medium">
                  Visit the store →
                </div>
              )
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
