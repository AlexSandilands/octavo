import { site } from "@/lib/site";
import { SponsorLogo } from "./shared";
import type { LayoutTheme } from "./types";

// The "Classic" layout theme: serif titles centred under decorative hairline
// rules, a double-ruled page frame with a small masthead, italic captions, and a
// bordered "patron" sponsor card. Extracted verbatim from the old inline
// `classic ? …` branches in block-view.tsx / page-frame.tsx (issue #40) — the
// look is unchanged; only its home moved.
export const classicTheme = {
  id: "classic",
  name: "Classic",

  heading: {
    kicker: "text-accent font-serif text-[13px] italic",
    paragraph: "text-ink font-serif text-[15px] leading-snug font-semibold",
    section: {
      wrapper: "border-hair-warm border-t pt-3.5",
      title: "text-ink font-serif text-[24px] leading-tight",
    },
    main: {
      wrapper: "text-center",
      title: "text-ink mt-1.5 font-serif text-[32px] leading-tight",
      rule: () => (
        <div className="mt-3 flex items-center justify-center gap-2.5">
          <div className="h-px w-10 bg-rule" />
          <div className="bg-accent h-1 w-1 rotate-45" />
          <div className="h-px w-10 bg-rule" />
        </div>
      ),
    },
  },

  image: {
    placeholder: {
      box: "photo-fill border-placeholder-line flex h-[150px] items-center justify-center border",
      label: "bg-page text-faint px-2 py-1 font-mono text-[11px]",
    },
    caption: (content) => (
      <figcaption className="text-muted mt-2.5 text-center font-serif text-sm italic">
        {content}
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
    <div className="border-hair border p-5 text-center">
      <div className="text-faint2 font-sans text-[9px] font-semibold tracking-[0.24em] uppercase">
        With thanks to our patron
      </div>
      <div
        className={`text-faint mx-auto mt-3.5 flex h-12 w-40 items-center justify-center font-mono text-[10px] ${
          logo ? "" : "border border-dashed border-dash"
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
        {editable ? nameField : name} {link && "→"}
      </div>
      {editable && (
        <div className="text-accent mt-1 font-sans text-[12px]">
          {hrefField}
        </div>
      )}
    </div>
  ),

  page: {
    decoration: ({ issueNo }) => (
      <>
        <div className="border-page-frame pointer-events-none absolute inset-3.5 border" />
        <div className="border-page-frame-soft pointer-events-none absolute inset-[17px] border" />
        <div className="text-faint2 pointer-events-none absolute top-5 right-3.5 left-3.5 text-center font-sans text-[8px] tracking-[0.32em] uppercase">
          {site.name} · No. {issueNo}
        </div>
      </>
    ),
  },
} satisfies LayoutTheme;
