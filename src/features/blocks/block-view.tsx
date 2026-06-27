import Image from "next/image";
import type { Block } from "@/lib/blocks";
import type { ImageMap, ResolvedImage } from "@/lib/images";
import { Editable } from "./editable";

export type Theme = "Classic" | "Modern";

// A resolved image, scaled to its container width at its natural aspect ratio.
// next/image needs intrinsic dimensions; older records may lack them, so fall
// back to a plain <img> in that case. Shared by the editor and both readers.
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
  onChange: (patch: Record<string, string | number>) => void;
};

// Read-only OR editable themed rendering of one block. Shared by the desktop
// reader and the admin editor. Body text scales with `textSize` (the A−/A+
// control); headings/captions stay fixed.
export function BlockView({
  block,
  theme,
  textSize = 17,
  edit,
  images,
  variant,
}: {
  block: Block;
  theme: Theme;
  textSize?: number;
  edit?: BlockEditHandlers;
  /** imageId → resolved R2 image; absent ids render as the photo placeholder. */
  images?: ImageMap;
  /** "cover" switches headings/text to the oversized, centred cover treatment. */
  variant?: "cover";
}) {
  const classic = theme === "Classic";

  // A text field: editable in place when `edit` is set, otherwise the raw text.
  const f = (field: string, value: string, placeholder: string) =>
    edit ? (
      <Editable
        value={value}
        placeholder={placeholder}
        onChange={(v) => edit.onChange({ [field]: v })}
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
              {f("kicker", block.kicker, "Masthead")}
            </div>
          )}
          <div
            className="text-ink mt-5 font-serif leading-[1.03]"
            style={{ fontSize: 50 }}
          >
            {f("title", block.title, "Cover title")}
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
        <p className="text-muted text-center font-serif text-[20px] leading-relaxed whitespace-pre-line italic">
          {f("text", block.text, "Add a tagline or date…")}
        </p>
      );
    }
  }

  switch (block.type) {
    case "heading":
      return classic ? (
        <div className="text-center">
          {(edit || block.kicker) && (
            <div className="text-accent font-serif text-sm italic">
              {f("kicker", block.kicker, "Kicker")}
            </div>
          )}
          <div className="text-ink mt-1.5 font-serif text-3xl leading-tight">
            {f("title", block.title, "Heading")}
          </div>
          <div className="mt-3 flex items-center justify-center gap-2.5">
            <div className="h-px w-10 bg-[#cfc6b4]" />
            <div className="bg-accent h-1 w-1 rotate-45" />
            <div className="h-px w-10 bg-[#cfc6b4]" />
          </div>
        </div>
      ) : (
        <div className="border-accent border-t-[3px] pt-3">
          {(edit || block.kicker) && (
            <div className="text-accent font-sans text-[11px] font-semibold tracking-[0.2em] uppercase">
              {f("kicker", block.kicker, "Kicker")}
            </div>
          )}
          <div className="text-ink mt-2.5 font-serif text-[32px] leading-none tracking-tight">
            {f("title", block.title, "Heading")}
          </div>
        </div>
      );

    case "text":
      return (
        <p
          className="text-body font-serif whitespace-pre-line"
          style={{ fontSize: textSize, lineHeight: 1.62 }}
        >
          {f("text", block.text, "Write your paragraph…")}
        </p>
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
              {f("caption", block.caption, "Caption (optional)")}
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
                {f("caption", block.caption, "Caption (optional)")}
              </span>
            </figcaption>
          )}
        </figure>
      );
    }

    case "sponsor":
      return classic ? (
        <div className="border-hair border p-5 text-center">
          <div className="text-faint2 font-sans text-[9px] font-semibold tracking-[0.24em] uppercase">
            With thanks to our patron
          </div>
          <div className="mx-auto mt-3.5 flex h-12 w-40 items-center justify-center border border-dashed border-[#c9c1b1] font-mono text-[10px] text-[#8a857b]">
            {block.logoId ? "LOGO" : "SPONSOR LOGO"}
          </div>
          <div className="text-accent mt-3 font-serif text-sm italic">
            {f("name", block.name, "Sponsor name")} {!edit && block.href && "→"}
          </div>
          {edit && (
            <div className="text-accent mt-1 font-sans text-[12px]">
              {f("href", block.href ?? "", "https://link (optional)")}
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
              {f("name", block.name, "Sponsor name")}
            </div>
            {edit ? (
              <div className="text-accent mt-1 font-sans text-[13px]">
                {f("href", block.href ?? "", "https://link (optional)")}
              </div>
            ) : (
              block.href && (
                <div className="text-accent mt-1 font-sans text-[13px] font-medium">
                  Visit the store →
                </div>
              )
            )}
          </div>
        </div>
      );
  }
}
