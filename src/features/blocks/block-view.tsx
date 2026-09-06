import Image from "next/image";
import {
  textAlignClass,
  textSizePx,
  type Block,
  type BlockPatch,
} from "@/lib/blocks";
import type { ImageMap, ResolvedImage } from "@/lib/images";
import type { SponsorMap } from "@/lib/sponsors";
import { externalHref } from "@/lib/rich-text";
import { richTextToPlain } from "@/lib/rich-text-doc";
import { pageAlignOf } from "./layout";
import type { LayoutTheme } from "./themes/registry";
import { RichText } from "./rich-text";
import { Editable } from "./editable";
import { MontageStill, resolveMontageSlides } from "./montage";
import { MontagePlayer } from "./montage-player";
import { VideoLink, VideoStill } from "./video";
import { VideoPlayer } from "./video-player";

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
  fit = "width",
}: {
  image: ResolvedImage;
  alt: string;
  /** Eager-load + preload this image (the LCP element). Offscreen images stay lazy. */
  priority?: boolean;
  /** How the photo meets a page-owning box (#227): "cover" crops it, "contain"
   *  fits it whole and centres it. Default keeps the natural ratio at column width. */
  fit?: "width" | "cover" | "contain";
}) {
  // Cropped a little above centre: in a portrait photo cropped to the page it is
  // the top of the frame that holds the subject.
  const className =
    fit === "cover"
      ? "h-full w-full object-cover object-[50%_40%]"
      : fit === "contain"
        ? "h-full w-full object-contain"
        : "h-auto w-full";
  if (image.width && image.height) {
    return (
      <Image
        src={image.url}
        alt={alt}
        width={image.width}
        height={image.height}
        sizes="(max-width: 768px) 100vw, 480px"
        className={className}
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
      className={className}
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

// Read-only OR editable rendering of one block, in a resolved layout theme
// (see themes/registry.ts). Shared by the desktop reader, the admin editor and
// the print/PDF path. Every per-theme styling decision comes from the `theme`
// object — no `theme === "…"` branches here, so a new layout theme is a new
// module, not an edit to this file. Body text scales with `textSize` (the A−/A+
// control); headings/captions stay fixed.
export function BlockView({
  block,
  theme,
  edit,
  images,
  sponsors,
  variant,
  priority = false,
  interactive = false,
  anchors = true,
}: {
  block: Block;
  theme: LayoutTheme;
  edit?: BlockEditHandlers;
  /** imageId → resolved R2 image; absent ids render as the photo placeholder. */
  images?: ImageMap;
  /** sponsorId → resolved managed sponsor; a missing id means it was deleted. */
  sponsors?: SponsorMap;
  /** "cover" switches headings/text to the oversized, centred cover treatment. */
  variant?: "cover";
  /** Eager-load this block's image (LCP). Only set for above-the-fold heroes. */
  priority?: boolean;
  /**
   * Set by the readers, where a block may animate and be driven by the member.
   * Left off by the print/PDF document, the editor canvas and the library
   * thumbnail, which must render one deterministic frame with no client JS —
   * currently the difference between a playing montage and its first slide.
   */
  interactive?: boolean;
  /**
   * Whether this surface may emit real <a> elements — the sponsor card's link
   * and the video block's address line. Cleared by the library thumbnail, which
   * renders a whole page *inside* its card's own <Link href="/read/…">: an
   * anchor nested in an anchor is invalid HTML that the parser splits apart, so
   * the server markup and the client tree disagree (hydration mismatch) and the
   * inner link claims part of the card's click area. With it off both render
   * their identical text as a <span>. Left on everywhere else — in particular
   * the print/PDF document, where the real <a> is what Chromium's page.pdf()
   * turns into the PDF's live link annotation.
   */
  anchors?: boolean;
}) {
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
  // sized/centred by `blockFlowStyle`'s cover branch). The cover treatment is
  // the same across layout themes, so it stays here rather than in the modules.
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
            <div className="h-px w-16 bg-rule" />
            <div className="bg-accent h-1.5 w-1.5 rotate-45" />
            <div className="h-px w-16 bg-rule" />
          </div>
        </div>
      );
    }
    if (block.type === "text") {
      return (
        <p className="text-muted text-center font-serif text-[24px] leading-relaxed whitespace-pre-line italic">
          {/* Cover text is authored as a plain tagline/date; coerce so a value
              that ever held rich JSON still renders as a string. */}
          {f(
            (v) => ({ text: v }),
            richTextToPlain(block.text),
            "Add a tagline or date…",
          )}
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

      // Small run-in sub-head — no kicker, its own title treatment.
      if (level === "paragraph") {
        return (
          <Title className={theme.heading.paragraph}>
            {f((v) => ({ title: v }), block.title, "Sub-heading")}
          </Title>
        );
      }

      // Kicker (eyebrow) sits above main/section titles.
      const kicker = (edit || block.kicker) && (
        <div className={theme.heading.kicker}>
          {f((v) => ({ kicker: v }), block.kicker, "Kicker")}
        </div>
      );
      const style =
        level === "section" ? theme.heading.section : theme.heading.main;
      const rule = level === "main" ? theme.heading.main.rule?.() : null;
      return (
        <div className={style.wrapper}>
          {kicker}
          <Title className={style.title}>
            {f(
              (v) => ({ title: v }),
              block.title,
              level === "section" ? "Section heading" : "Heading",
            )}
          </Title>
          {rule}
        </div>
      );
    }

    case "text":
      // Body text is a structured rich-text doc (content v3), rendered through
      // React elements — no dangerouslySetInnerHTML. Legacy string values render
      // through the same path (RichText coerces them). Editing this block goes
      // through RichTextEditor in editor-block.tsx, not `f()`.
      return (
        <div
          className={`text-body font-serif rich-text ${textAlignClass(block.align)}`}
          style={{ fontSize: textSizePx(block.size), lineHeight: 1.62 }}
        >
          <RichText value={block.text} />
        </div>
      );

    case "image": {
      const resolved = block.imageId ? images?.[block.imageId] : undefined;
      // Page-owning (v6): fill crops, fit letterboxes; no caption either way,
      // and a cover never bleeds.
      const owns = variant === "cover" ? null : pageAlignOf(block);
      const bleed = owns !== null;
      // Prefer the authored alt text; fall back to the caption so an uncaptioned
      // photo is still described rather than announced decorative.
      const photo = resolved ? (
        <BlockImage
          image={resolved}
          alt={block.alt || block.caption}
          priority={priority}
          fit={owns === "page-fill" ? "cover" : owns ? "contain" : "width"}
        />
      ) : (
        <div
          className={theme.image.placeholder.box}
          style={bleed ? { height: "100%" } : undefined}
        >
          <span className={theme.image.placeholder.label}>
            {block.caption || "PHOTO"}
          </span>
        </div>
      );
      // bg-page so a fitted photo's bars are the page's own colour on every surface.
      if (bleed) return <figure className="bg-page h-full">{photo}</figure>;
      const showCaption = edit || block.caption;
      return (
        <figure>
          {photo}
          {showCaption &&
            theme.image.caption(
              f((v) => ({ caption: v }), block.caption, "Caption (optional)"),
            )}
        </figure>
      );
    }

    case "montage": {
      // Content v4. Same figure and caption treatment as an image block — a
      // montage is a photo slot that happens to hold several photos — so it
      // picks up the theme's frame for free. On the read path it cross-fades
      // and takes prev/next from the member; everywhere else (print/PDF, the
      // editor canvas, the library thumbnail) it renders its first slide only.
      const slides = resolveMontageSlides(block.items, images);
      const picture =
        slides.length === 0 ? (
          <div className={theme.image.placeholder.box}>
            <span className={theme.image.placeholder.label}>
              {block.caption || "MONTAGE"}
            </span>
          </div>
        ) : interactive ? (
          <MontagePlayer
            slides={slides}
            intervalSeconds={block.interval}
            label={block.caption}
          />
        ) : (
          <MontageStill slides={slides} priority={priority} />
        );
      const showCaption = edit || block.caption;
      return (
        <figure>
          {picture}
          {showCaption &&
            theme.image.caption(
              f((v) => ({ caption: v }), block.caption, "Caption (optional)"),
            )}
        </figure>
      );
    }

    case "video": {
      // Content v5. Same figure and caption treatment as an image block — a
      // video occupies a photo slot that happens to move — so it picks up the
      // theme's frame for free, in a 16:9 box. On the read path it plays behind
      // a facade (no third-party frame until the member presses play);
      // everywhere else (print/PDF, the editor canvas, the library thumbnail) it
      // is the poster plus the address in readable text.
      const poster = block.posterImageId
        ? images?.[block.posterImageId]
        : undefined;
      const picture = !block.videoId ? (
        <div className={theme.image.placeholder.box}>
          <span className={theme.image.placeholder.label}>
            {block.caption || "VIDEO"}
          </span>
        </div>
      ) : interactive ? (
        <VideoPlayer
          videoId={block.videoId}
          poster={poster}
          label={block.caption}
        />
      ) : (
        <VideoStill poster={poster} priority={priority} />
      );
      const showCaption = edit || block.caption;
      return (
        <figure>
          {picture}
          {showCaption &&
            theme.image.caption(
              f((v) => ({ caption: v }), block.caption, "Caption (optional)"),
            )}
          {/* The address, under the caption, on every non-playing surface — it
              is the whole point of the printed representation. In the editor it
              renders as text rather than a link: an admin mid-edit clicking
              their own page's furniture should not leave the editor. */}
          {!interactive && block.videoId && (
            <VideoLink videoId={block.videoId} asLink={!edit && anchors} />
          )}
        </figure>
      );
    }

    case "sponsor": {
      // v1→v2 compatibility lives here. A managed block (`sponsorId` set) resolves
      // its name/href/logo from the sponsors map; a version-1 or manual block
      // (no `sponsorId`) falls back to its inline fields, so legacy documents
      // render through the identical code path they always did. The theme only
      // lays the resolved data out (themes/shared.ts SponsorCardProps).
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
      const editable = Boolean(edit && !isManaged);
      const link = edit ? null : externalHref(href ?? "");
      const card = theme.sponsor({
        name,
        logo,
        isManaged,
        editable,
        link,
        nameField: editable
          ? f((v) => ({ name: v }), block.name, "Sponsor name")
          : name,
        hrefField: editable
          ? f((v) => ({ href: v }), block.href ?? "", "https://link (optional)")
          : null,
      });
      // The card still takes `link` when anchors are off, so the affordance it
      // draws from it (the "→", the "Visit the store" line) is unchanged — the
      // thumbnail is a to-scale render of the page, not a different page.
      return link && anchors ? (
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
