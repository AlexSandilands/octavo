import { SponsorLogo } from "./shared";
import type { LayoutTheme } from "./types";

// The "Modern" layout theme: accent-ruled headings with uppercase sans kickers,
// a single accent spine bar for the page frame, an accent-tick caption, and a
// horizontal tinted sponsor card. Extracted verbatim from the old inline
// `classic ? … : …` else-branches in block-view.tsx / page-frame.tsx (issue #40).
export const modernTheme = {
  id: "modern",
  name: "Modern",

  heading: {
    kicker:
      "text-accent font-sans text-[10px] font-semibold tracking-[0.2em] uppercase",
    paragraph:
      "text-accent font-sans text-[12px] font-semibold tracking-[0.08em] uppercase",
    section: {
      wrapper: "border-accent border-t-[2px] pt-2.5",
      title:
        "text-ink mt-1 font-serif text-[24px] leading-tight tracking-tight",
    },
    main: {
      wrapper: "border-accent border-t-[3px] pt-3",
      title:
        "text-ink mt-2.5 font-serif text-[32px] leading-none tracking-tight",
    },
  },

  image: {
    // The green placeholder fill is a deliberate heritage-flavoured constant (a
    // rare missing-image state), not a brand token — see docs note in globals.css.
    placeholder: {
      box: "photo-fill-green flex h-[150px] items-center justify-center",
      label:
        "text-cream bg-[rgba(20,40,30,0.4)] px-2 py-1 font-mono text-[11px]",
    },
    caption: (content) => (
      <figcaption className="mt-2.5 flex items-start gap-2.5">
        <div className="bg-accent h-7 w-[3px] flex-none" />
        <span className="text-muted font-sans text-[13px] leading-snug">
          {content}
        </span>
      </figcaption>
    ),
  },

  sponsor: ({
    name,
    logo,
    isManaged,
    editable,
    link,
    nameField,
    hrefField,
  }) => (
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
          {editable ? nameField : name}
        </div>
        {editable ? (
          <div className="text-accent mt-1 font-sans text-[13px]">
            {hrefField}
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
  ),

  page: {
    decoration: ({ side }) => (
      <div
        className={`bg-accent pointer-events-none absolute top-0 bottom-0 w-[5px] ${
          side === "left" ? "left-0" : "right-0"
        }`}
      />
    ),
  },
} satisfies LayoutTheme;
