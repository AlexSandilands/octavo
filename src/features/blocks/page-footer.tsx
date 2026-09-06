import type { CSSProperties } from "react";
import type { ResolvedImage } from "@/lib/images";
import type { FooterAlign, SiteSettings } from "@/lib/branding";

// The running footer at the foot of every magazine page. Two forms:
//
//  - with a logo (issue #97): the club's mark and the organisation's name as one
//    lockup, with the page number out at the opposite margin. The mark comes
//    from the per-issue `issues.logoId` and the wording from the magazine
//    settings — no club name or asset is baked in here.
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
// misses (and the no-logo branch is the common one). The one page with no
// footer at all is the full-bleed one (issue #227), where PageFrame doesn't
// render this component — and `useTextFlow` leaves those pages unmeasured by
// name rather than by noticing the absence.
//
// An earlier draft spread the organisation's name letter by letter across the
// full page width. The club read the word gaps as holes and stopped reading the
// name as a name, so the wording is set at the footer's ordinary tracking here.
//
// The owner sets the type size, the mark's size and the lockup's alignment at
// /admin/magazine (issue #105); the 27px/10px/left defaults reproduce the
// footer exactly as issue #104 shipped it. Type size deliberately applies to
// BOTH forms — they share one treatment, so sizing only one would reintroduce
// the change of voice between an issue with a mark and one without. Mark size
// and alignment have nothing to act on in the no-logo form, which keeps its
// fixed name / issue-no / folio spread.
//
// The two sizes are px numbers (issue #216) set as inline styles: an
// owner-typed value is not a literal Tailwind can see at build time.

// The footer row's own type treatment — deliberately the no-logo footer's, so
// turning from an issue that carries a mark to one that doesn't is not a change
// of voice. Shared with the mobile reader, which has no pages to put a footer on
// but closes the issue with the same lockup. Pair with `footerTextStyle`.
export const FOOTER_ROW_CLASS =
  "text-faint2 flex items-center font-sans font-medium tracking-[0.12em] uppercase";

/** The footer's type size, as the style the row carries beside FOOTER_ROW_CLASS. */
export function footerTextStyle(textSize: number): CSSProperties {
  return { fontSize: textSize };
}

// Where the lockup sits in a row that holds nothing else (the mobile closer).
// The page footer can't use these — it has a folio to place against the
// opposite margin — but the two must agree, so the meaning of each value lives
// here once. Alignment is absolute: both leaves of a spread and the phone all
// range the same way.
export const LOCKUP_ALIGN: Record<FooterAlign, string> = {
  left: "",
  center: "justify-center",
  right: "justify-end",
};

export function PageFooter({
  logo,
  issueNo,
  pageNo,
  side,
  logoBottom,
  settings,
}: {
  /** The issue's chosen mark, or null for the text-only footer. */
  logo: ResolvedImage | null;
  issueNo: number;
  pageNo?: number;
  side: "left" | "right";
  /** The theme's clearance for the mark — see `LayoutTheme.page.logoFooterBottom`.
   *  Applies to the logo form only; the text footer's own offset is fixed. */
  logoBottom: string;
  /** The magazine's effective branding + footer appearance (issue #105). */
  settings: SiteSettings;
}) {
  const { footer } = settings;
  if (!logo) {
    return (
      <div
        data-page-footer
        style={footerTextStyle(footer.textSize)}
        className="text-faint2 absolute right-10 bottom-4 left-10 flex justify-between font-sans font-medium tracking-[0.12em] uppercase"
      >
        <span>{side === "left" ? settings.name : `No. ${issueNo}`}</span>
        <span>{pageNo ?? ""}</span>
      </div>
    );
  }
  // The issue number is deliberately not repeated here: the client asked for
  // "just the fern followed by the wording", and the classic theme's running
  // head already carries `No. N` at the top of the page.
  const lockup = (
    <FooterWordmark logo={logo} org={settings.org} markSize={footer.markSize} />
  );
  const folio = pageNo ?? "";
  return (
    <div
      data-page-footer
      style={footerTextStyle(footer.textSize)}
      className={`absolute right-10 left-10 justify-between ${logoBottom} ${FOOTER_ROW_CLASS}`}
    >
      {/* pl-6/pr-6 rather than a row gap: the folio is the only thing at the far
          margin, and the padding keeps it off a long name that has run out of
          room to shrink. */}
      {footer.align === "right" ? (
        <>
          <span className="flex-none pr-6">{folio}</span>
          {lockup}
        </>
      ) : footer.align === "center" ? (
        <>
          {/* An empty cell mirroring the folio's own — same flex, same padding —
              keeps the lockup on the page's centre line while the folio stays
              out at the margin. The padding has to be mirrored, not just the
              flex: it sits outside the flex base size, so a bare `flex-1` here
              would leave the lockup half a padding left of centre. */}
          <span className="flex-1 pr-6" />
          {lockup}
          <span className="flex flex-1 justify-end pl-6">{folio}</span>
        </>
      ) : (
        <>
          {lockup}
          <span className="flex-none pl-6">{folio}</span>
        </>
      )}
    </div>
  );
}

// The mark and the organisation's name as a single lockup, so a caller that puts
// something else in the row (the page footer's folio) ranges it against the
// opposite margin instead of pushing the name into the middle.
export function FooterWordmark({
  logo,
  org,
  markSize,
}: {
  logo: ResolvedImage;
  org: string;
  /** The mark's box height in px. */
  markSize: number;
}) {
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
        style={{ height: markSize }}
        className="w-auto flex-none opacity-60"
        aria-hidden="true"
      />
      {/* Truncating is the graceful end of the range for an organisation name
          far longer than this one — better than running under the folio. */}
      <span className="min-w-0 truncate">{org}</span>
    </span>
  );
}
