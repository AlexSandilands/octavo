import Image from "next/image";
import { textSizePx, type Block, type BlockPatch } from "@/lib/blocks";
import type { ImageMap, ResolvedImage } from "@/lib/images";
import type { SponsorMap } from "@/lib/sponsors";
import { externalHref, richTextToHtml } from "@/lib/rich-text";
import { Editable } from "./editable";

// A sponsor logo, contained within its fixed slot at whatever aspect it has.
// A plain <img> (not next/image) because the slot is a fixed box and object-fit
// does the work; logos are small, so intrinsic-size optimisation isn't worth it.
function SponsorLogo({ logo, name }: { logo: ResolvedImage; name: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo.url}
      alt={name ? `${name} logo` : "Sponsor logo"}
      className="h-full w-full object-contain"
    />
  );
}

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
  priority = false,
}: {
  image: ResolvedImage;
  alt: string;
  /** Eager-load + preload this image (the LCP element). Offscreen images stay lazy. */
  priority?: boolean;
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
        priority={priority}
        unoptimized
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image.url}
      alt={alt}
      className="h-auto w-full"
      fetchPriority={priority ? "high" : undefined}
    />
  );
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
  sponsors,
  variant,
  priority = false,
}: {
  block: Block;
  theme: Theme;
  edit?: BlockEditHandlers;
  /** imageId → resolved R2 image; absent ids render as the photo placeholder. */
  images?: ImageMap;
  /** sponsorId → resolved managed sponsor; a missing id means it was deleted. */
  sponsors?: SponsorMap;
  /** "cover" switches headings/text to the oversized, centred cover treatment. */
  variant?: "cover";
  /** Eager-load this block's image (LCP). Only set for above-the-fold heroes. */
  priority?: boolean;
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
      // Read path emits a real heading so screen readers get a document outline;
      // the editor keeps a <div> so it doesn't fight contentEditable.
      const CoverTitle = edit ? "div" : "h2";
      return (
        <div className="text-center">
          {(edit || block.kicker) && (
            <div className="text-accent font-sans text-[12px] font-semibold tracking-[0.34em] uppercase">
              {f((v) => ({ kicker: v }), block.kicker, "Masthead")}
            </div>
          )}
          <CoverTitle
            className="text-ink mt-5 font-serif leading-[1.03]"
            style={{ fontSize: 68 }}
          >
            {f((v) => ({ title: v }), block.title, "Cover title")}
          </CoverTitle>
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
      // On the read path emit a real heading element (paragraph sub-heads → h3,
      // everything else → h2) so screen readers get an outline; the editor keeps
      // a <div> so semantics don't fight contentEditable. Mirrors mobile-reader.
      const Title = edit ? "div" : level === "paragraph" ? "h3" : "h2";
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
          <Title
            className={
              classic
                ? "text-ink font-serif text-[15px] leading-snug font-semibold"
                : "text-accent font-sans text-[12px] font-semibold tracking-[0.08em] uppercase"
            }
          >
            {f((v) => ({ title: v }), block.title, "Sub-heading")}
          </Title>
        );
      }

      if (classic) {
        return level === "section" ? (
          <div className="border-t border-[#e0d9c9] pt-3.5">
            {kicker}
            <Title className="text-ink font-serif text-[24px] leading-tight">
              {f((v) => ({ title: v }), block.title, "Section heading")}
            </Title>
          </div>
        ) : (
          <div className="text-center">
            {kicker}
            <Title className="text-ink mt-1.5 font-serif text-[32px] leading-tight">
              {f((v) => ({ title: v }), block.title, "Heading")}
            </Title>
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
          <Title className="text-ink mt-1 font-serif text-[24px] leading-tight tracking-tight">
            {f((v) => ({ title: v }), block.title, "Section heading")}
          </Title>
        </div>
      ) : (
        <div className="border-accent border-t-[3px] pt-3">
          {kicker}
          <Title className="text-ink mt-2.5 font-serif text-[32px] leading-none tracking-tight">
            {f((v) => ({ title: v }), block.title, "Heading")}
          </Title>
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
      // Prefer the authored alt text; fall back to the caption so an uncaptioned
      // photo is still described rather than announced decorative.
      const photo = resolved ? (
        <BlockImage
          image={resolved}
          alt={block.alt || block.caption}
          priority={priority}
        />
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
      // v1→v2 compatibility lives here. A managed block (`sponsorId` set) resolves
      // its name/href/logo from the sponsors map; a version-1 or manual block
      // (no `sponsorId`) falls back to its inline fields, so legacy documents
      // render through the identical code path they always did.
      const managed = block.sponsorId ? sponsors?.[block.sponsorId] : undefined;
      const isManaged = Boolean(block.sponsorId);
      // A managed reference that no longer resolves means the sponsor was
      // deleted. Read-only: hide the slot — a removed sponsor must not keep
      // advertising. In the editor we keep it visible so the admin can re-pick
      // or delete it (the picker control shows the "removed" state).
      if (isManaged && !managed && !edit) return null;

      const name = managed ? managed.name : block.name;
      const href = managed ? managed.href : (block.href ?? "");
      const logo = managed?.logo ?? null;
      // Inline (manual/v1) name+href stay editable in place; a managed reference
      // is edited through the picker control, so it renders read-only.
      const editable = edit && !isManaged;
      const link = edit ? null : externalHref(href ?? "");

      const card = classic ? (
        <div className="border-hair border p-5 text-center">
          <div className="text-faint2 font-sans text-[9px] font-semibold tracking-[0.24em] uppercase">
            With thanks to our patron
          </div>
          <div
            className={`text-faint mx-auto mt-3.5 flex h-12 w-40 items-center justify-center font-mono text-[10px] ${
              logo ? "" : "border border-dashed border-[#c9c1b1]"
            }`}
          >
            {logo ? (
              <SponsorLogo logo={logo} name={name} />
            ) : isManaged ? (
              "SPONSOR REMOVED"
            ) : (
              "SPONSOR LOGO"
            )}
          </div>
          <div className="text-accent mt-3 font-serif text-sm italic">
            {editable
              ? f((v) => ({ name: v }), block.name, "Sponsor name")
              : name}{" "}
            {link && "→"}
          </div>
          {editable && (
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
          <div
            className={`text-faint flex h-12 w-28 flex-none items-center justify-center rounded font-mono text-[10px] ${
              logo ? "bg-card overflow-hidden" : "bg-card"
            }`}
          >
            {logo ? (
              <SponsorLogo logo={logo} name={name} />
            ) : isManaged ? (
              "REMOVED"
            ) : (
              "SPONSOR LOGO"
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-accent-soft font-sans text-[9px] font-semibold tracking-[0.2em] uppercase">
              Sponsor
            </div>
            <div className="text-accent-ink mt-1 font-sans text-base font-semibold">
              {editable
                ? f((v) => ({ name: v }), block.name, "Sponsor name")
                : name}
            </div>
            {editable ? (
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
