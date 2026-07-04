import { Icon } from "@/components/icons";
import { FigureBadge, FigureFrame } from "./guide-ui";

// The "one record, reused everywhere" idea as a diagram: the sponsor record on
// the left, flowing into the sponsor card on the pages of two different
// issues. Built from the site's tokens; decorative (FigureFrame hides it from
// screen readers) — the numbered steps in section-sponsors.tsx carry the
// meaning.

function MiniPage({ issueNo, badge }: { issueNo: number; badge?: boolean }) {
  return (
    <div className="bg-page w-[126px] rounded-[2px] p-2.5 shadow-[0_2px_8px_rgba(20,32,28,0.18)]">
      <div className="text-faint2 font-sans text-[8px] tracking-[0.12em] uppercase">
        Issue No. {issueNo}
      </div>
      <div className="bg-rule mt-1.5 h-[5px] w-3/4 rounded-xs" />
      <div className="bg-line mt-2 h-[4px] w-full rounded-xs" />
      <div className="bg-line mt-1 h-[4px] w-11/12 rounded-xs" />
      <div className="bg-line mt-1 h-[4px] w-full rounded-xs" />
      <div className="border-hair-warm mt-2 flex items-center gap-1.5 rounded-[4px] border bg-white p-1.5">
        {badge && <FigureBadge n={2} />}
        <span className="photo-fill h-4 w-4 flex-none rounded-[2px]" />
        <span className="text-ink font-sans text-[8px] leading-tight font-semibold">
          Harbour Bakery
        </span>
      </div>
      <div className="bg-line mt-2 h-[4px] w-10/12 rounded-xs" />
    </div>
  );
}

export function SponsorsFigure() {
  return (
    <FigureFrame caption="One sponsor record, reused everywhere it appears. The numbers match the steps below.">
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
        {/* The record, as kept on the Sponsors screen. */}
        <div className="border-hair w-[190px] flex-none rounded-lg border bg-white p-4">
          <div className="flex items-center gap-2">
            <FigureBadge n={1} />
            <span className="text-faint font-sans text-[8.5px] font-semibold tracking-[0.14em] uppercase">
              Sponsor record
            </span>
          </div>
          <span className="photo-fill mt-2.5 block h-10 w-10 rounded-[4px]" />
          <div className="text-ink mt-2 font-sans text-[13px] font-semibold">
            Harbour Bakery
          </div>
          <div className="text-accent font-sans text-[11px] underline">
            harbourbakery.nz
          </div>
          <div className="text-faint2 mt-1.5 font-sans text-[10px]">
            Active until Jun 2027
          </div>
        </div>
        {/* Update once → flows to every issue that picked it. */}
        <div className="flex flex-none items-center gap-1.5 sm:flex-col">
          <FigureBadge n={3} />
          <Icon name="arrowDown" size={16} className="text-faint2 sm:hidden" />
          <Icon
            name="arrowRight"
            size={16}
            className="text-faint2 hidden sm:block"
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
