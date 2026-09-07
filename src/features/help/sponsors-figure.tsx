import { Icon } from "@/components/icons";
import { FigureBadge, FigureFrame } from "./guide-ui";

// The "one record, reused everywhere" idea as a diagram: the sponsor record on
// the left, flowing into the sponsor card on the pages of two different
// issues. Built from the site's tokens; decorative (FigureFrame hides it from
// screen readers) — the numbered steps in section-sponsors.tsx carry the
// meaning.

function MiniPage({ issueNo, badge }: { issueNo: number; badge?: boolean }) {
  return (
    <div className="bg-sheet border-hairline-strong w-[126px] border p-2.5">
      <div className="text-grey-soft font-ui text-[8px] tracking-[0.12em] uppercase">
        Issue No. {issueNo}
      </div>
      <div className="bg-hairline mt-1.5 h-[5px] w-3/4" />
      <div className="bg-hairline mt-2 h-[4px] w-full" />
      <div className="bg-hairline mt-1 h-[4px] w-11/12" />
      <div className="bg-hairline mt-1 h-[4px] w-full" />
      <div className="border-hairline-strong bg-sheet mt-2 flex items-center gap-1.5 border p-1.5">
        {badge && <FigureBadge n={2} />}
        <span className="photo-fill h-4 w-4 flex-none" />
        <span className="text-lead font-ui text-[8px] leading-tight font-semibold">
          Harbour Bakery
        </span>
      </div>
      <div className="bg-hairline mt-2 h-[4px] w-10/12" />
    </div>
  );
}

export function SponsorsFigure() {
  return (
    <FigureFrame caption="One sponsor record, reused everywhere it appears. The numbers match the steps below.">
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
        {/* The record, as kept on the Sponsors screen. */}
        <div className="border-lead bg-sheet w-[190px] flex-none border p-4">
          <div className="flex items-center gap-2">
            <FigureBadge n={1} />
            <span className="text-grey-soft font-ui text-[8.5px] font-semibold tracking-[0.14em] uppercase">
              Sponsor record
            </span>
          </div>
          <span className="photo-fill border-lead mt-2.5 block h-10 w-10 border" />
          <div className="text-lead mt-2 font-ui text-[13px] font-semibold">
            Harbour Bakery
          </div>
          <div className="text-red font-ui text-[11px] font-semibold underline">
            harbourbakery.nz
          </div>
          <div className="text-grey-soft mt-1.5 font-ui text-[10px]">
            Active until Jun 2027
          </div>
        </div>
        {/* Update once → flows to every issue that picked it. */}
        <div className="flex flex-none items-center gap-1.5 sm:flex-col">
          <FigureBadge n={3} />
          <Icon name="arrowDown" size={16} className="text-grey sm:hidden" />
          <Icon
            name="arrowRight"
            size={16}
            className="text-grey hidden sm:block"
          />
        </div>
        <div className="flex flex-none gap-3">
          <MiniPage issueNo={3} badge />
          <MiniPage issueNo={4} />
        </div>
      </div>
    </FigureFrame>
  );
}
