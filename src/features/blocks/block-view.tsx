import type { Block } from "@/lib/blocks";

export type Theme = "Classic" | "Modern";

// Read-only, themed rendering of one block. Shared by the desktop and mobile
// readers (and reused for the editor preview). Body text scales with `textSize`
// (the A−/A+ control); headings/captions stay fixed.
export function BlockView({
  block,
  theme,
  textSize = 17,
}: {
  block: Block;
  theme: Theme;
  textSize?: number;
}) {
  const classic = theme === "Classic";

  switch (block.type) {
    case "heading":
      return classic ? (
        <div className="text-center">
          {block.kicker && (
            <div className="text-accent font-serif text-sm italic">
              {block.kicker}
            </div>
          )}
          <div className="text-ink mt-1.5 font-serif text-3xl leading-tight">
            {block.title}
          </div>
          <div className="mt-3 flex items-center justify-center gap-2.5">
            <div className="h-px w-10 bg-[#cfc6b4]" />
            <div className="bg-accent h-1 w-1 rotate-45" />
            <div className="h-px w-10 bg-[#cfc6b4]" />
          </div>
        </div>
      ) : (
        <div className="border-accent border-t-[3px] pt-3">
          {block.kicker && (
            <div className="text-accent font-sans text-[11px] font-semibold tracking-[0.2em] uppercase">
              {block.kicker}
            </div>
          )}
          <div className="text-ink mt-2.5 font-serif text-[32px] leading-none tracking-tight">
            {block.title}
          </div>
        </div>
      );

    case "text":
      return (
        <p
          className="text-body font-serif"
          style={{ fontSize: textSize, lineHeight: 1.62 }}
        >
          {block.text}
        </p>
      );

    case "image":
      return classic ? (
        <figure>
          <div className="photo-fill flex h-[150px] items-center justify-center border border-[#e2dccf]">
            <span className="bg-page text-faint px-2 py-1 font-mono text-[11px]">
              {block.caption || "PHOTO"}
            </span>
          </div>
          {block.caption && (
            <figcaption className="text-muted mt-2.5 text-center font-serif text-sm italic">
              {block.caption}
            </figcaption>
          )}
        </figure>
      ) : (
        <figure>
          <div className="photo-fill-green flex h-[150px] items-center justify-center">
            <span className="text-cream bg-[rgba(20,40,30,0.4)] px-2 py-1 font-mono text-[11px]">
              {block.caption || "PHOTO"}
            </span>
          </div>
          {block.caption && (
            <figcaption className="mt-2.5 flex items-start gap-2.5">
              <div className="bg-accent h-7 w-[3px] flex-none" />
              <span className="text-muted font-sans text-[13px] leading-snug">
                {block.caption}
              </span>
            </figcaption>
          )}
        </figure>
      );

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
            {block.name} {block.href && "→"}
          </div>
        </div>
      ) : (
        <div className="bg-tint flex items-center gap-4 rounded-md p-4">
          <div className="bg-card text-faint flex h-12 w-28 flex-none items-center justify-center rounded font-mono text-[10px]">
            {block.logoId ? "LOGO" : "SPONSOR LOGO"}
          </div>
          <div>
            <div className="text-accent-soft font-sans text-[9px] font-semibold tracking-[0.2em] uppercase">
              Sponsor
            </div>
            <div className="text-accent-ink mt-1 font-sans text-base font-semibold">
              {block.name}
            </div>
            {block.href && (
              <div className="text-accent mt-1 font-sans text-[13px] font-medium">
                Visit the store →
              </div>
            )}
          </div>
        </div>
      );
  }
}
