import { site } from "@/lib/site";
import type { ResolvedImage } from "@/lib/images";

// The running footer at the foot of every magazine page. Two forms:
//
//  - with a logo (issue #97): the club's mark, then the organisation's name
//    spread across the width of the page, then the page number. The mark comes
//    from the per-issue `issues.logoId` and the wording from NEXT_PUBLIC_ORG_NAME
//    — no club name or asset is baked in here.
//  - without one: the original name / issue-number / page-number row, unchanged.
//    Most issues have no logo, and an issue that never picks one must keep the
//    footer it was authored against.
//
// Shared by every surface that draws a page (reader spread, editor canvas,
// library thumbnails, the print document), so all four agree by construction.
//
// Both forms render as exactly ONE element carrying `data-page-footer`: the
// editor's overflow detection (issue #93) measures that element's top edge as
// the page's text limit. Keep it a single box — splitting it, or dropping the
// attribute from either branch, silently blinds that check on the pages it
// misses (and the no-logo branch is the common one).

// The footer row's own type treatment. Shared with the mobile reader, which has
// no pages to put a footer on but closes the issue with the same wordmark.
export const FOOTER_ROW =
  "text-faint2 flex items-center gap-5 font-sans text-[10px] font-medium uppercase";

export function PageFooter({
  logo,
  issueNo,
  pageNo,
  side,
}: {
  /** The issue's chosen mark, or null for the text-only footer. */
  logo: ResolvedImage | null;
  issueNo: number;
  pageNo?: number;
  side: "left" | "right";
}) {
  if (!logo) {
    return (
      <div
        data-page-footer
        className="text-faint2 absolute right-10 bottom-4 left-10 flex justify-between font-sans text-[10px] font-medium tracking-[0.12em] uppercase"
      >
        <span>{side === "left" ? site.name : `No. ${issueNo}`}</span>
        <span>{pageNo ?? ""}</span>
      </div>
    );
  }
  // The issue number is deliberately not repeated here: the client asked for
  // "just the fern followed by the wording", and the classic theme's running
  // head already carries `No. N` at the top of the page.
  return (
    <div
      data-page-footer
      className={`absolute right-10 bottom-4 left-10 ${FOOTER_ROW}`}
    >
      <FooterWordmark logo={logo} />
      {/* The folio needs a clear step away from the wordmark: the letters are
          spread ~20px apart, so the row's own gap alone would read the page
          number as one more letter of the name. */}
      <span className="flex-none pl-6 tracking-[0.12em]">{pageNo ?? ""}</span>
    </div>
  );
}

// The mark plus the organisation's name, sized to fill whatever row it is
// dropped into. Returns two flex children rather than its own box so the caller
// owns the row (the page footer adds a page number to it; the mobile reader
// doesn't).
export function FooterWordmark({ logo }: { logo: ResolvedImage }) {
  return (
    <>
      {/* Decorative: the wording beside it already names the organisation.
          A plain <img>, not next/image — the mark is a handful of KB in a
          fixed-height box, and an eagerly-loaded plain image is what the PDF
          generator needs (a lazy one prints as a gap; see the #16 lesson). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logo.url}
        alt=""
        className="h-[18px] w-auto flex-none opacity-60"
        aria-hidden="true"
      />
      <SpreadWordmark text={site.org} />
    </>
  );
}

// The wording "across the full width of the page": every glyph is its own flex
// item, so `justify-between` puts the slack *between the letters* instead of
// leaving it at the end — which is why this row carries no tracking of its own.
// A space renders as an empty item, so word gaps come out at twice a letter gap.
//
// Screen readers get the name once, intact, from the visually-hidden span; the
// glyphs are hidden from them so the name isn't spelled out letter by letter on
// every page of the issue.
function SpreadWordmark({ text }: { text: string }) {
  return (
    <span className="flex min-w-0 flex-1 justify-between overflow-hidden">
      <span className="sr-only">{text}</span>
      {[...text].map((ch, i) => (
        <span key={`${ch}-${i}`} aria-hidden="true">
          {ch === " " ? null : ch}
        </span>
      ))}
    </span>
  );
}
