import { site } from "@/lib/site";
import type { ResolvedImage } from "@/lib/images";

// The running footer at the foot of every magazine page. Two forms:
//
//  - with a logo (issue #97): the club's mark and the organisation's name as one
//    lockup ranged left, with the page number out at the right margin. The mark
//    comes from the per-issue `issues.logoId` and the wording from
//    NEXT_PUBLIC_ORG_NAME — no club name or asset is baked in here.
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
//
// An earlier draft spread the organisation's name letter by letter across the
// full page width. The club read the word gaps as holes and stopped reading the
// name as a name, so the wording is set at the footer's ordinary tracking here.

// The footer row's own type treatment — deliberately the no-logo footer's, so
// turning from an issue that carries a mark to one that doesn't is not a change
// of voice. Shared with the mobile reader, which has no pages to put a footer on
// but closes the issue with the same lockup.
export const FOOTER_ROW =
  "text-faint2 flex items-center font-sans text-[10px] font-medium tracking-[0.12em] uppercase";

export function PageFooter({
  logo,
  issueNo,
  pageNo,
  side,
  logoBottom,
}: {
  /** The issue's chosen mark, or null for the text-only footer. */
  logo: ResolvedImage | null;
  issueNo: number;
  pageNo?: number;
  side: "left" | "right";
  /** The theme's clearance for the mark — see `LayoutTheme.page.logoFooterBottom`.
   *  Applies to the logo form only; the text footer's own offset is fixed. */
  logoBottom: string;
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
      className={`absolute right-10 left-10 justify-between ${logoBottom} ${FOOTER_ROW}`}
    >
      <FooterWordmark logo={logo} />
      {/* pl-6 rather than a row gap: the folio is the only thing at the far
          margin, and the padding keeps it off a long name that has run out of
          room to shrink. */}
      <span className="flex-none pl-6">{pageNo ?? ""}</span>
    </div>
  );
}

// The mark and the organisation's name as a single lockup, so a caller that puts
// something else in the row (the page footer's folio) ranges it against the
// opposite margin instead of pushing the name into the middle.
export function FooterWordmark({ logo }: { logo: ResolvedImage }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      {/* Decorative: the wording beside it already names the organisation.
          A plain <img>, not next/image — the mark is a handful of KB in a
          fixed-height box, and an eagerly-loaded plain image is what the PDF
          generator needs (a lazy one prints as a gap; see the #16 lesson). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logo.url}
        alt=""
        className="h-[27px] w-auto flex-none opacity-60"
        aria-hidden="true"
      />
      {/* Truncating is the graceful end of the range for an organisation name
          far longer than this one — better than running under the folio. */}
      <span className="min-w-0 truncate">{site.org}</span>
    </span>
  );
}
