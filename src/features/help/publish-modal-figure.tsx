import { Icon } from "@/components/icons";
import { FigureBadge, FigureFrame } from "./guide-ui";

// A close-up mock of the publish confirmation window (publish-modal.tsx),
// built from the site's tokens. Decorative (FigureFrame hides it from screen
// readers); the numbered legend in section-publishing.tsx carries the meaning.
export function PublishModalFigure() {
  return (
    <FigureFrame caption="The confirmation window up close. The numbers match the list below.">
      <div className="bg-paper shadow-panel rounded-sheet mx-auto w-full max-w-[440px] p-5 sm:p-6">
        <div className="text-brass-ink font-ui text-[9.5px] font-semibold tracking-[0.2em] uppercase">
          Publish &amp; send
        </div>
        <div className="text-ink mt-2 font-display text-[21px] leading-tight">
          Publish issue No. 4?
        </div>
        <p className="text-muted mt-1.5 font-ui text-[12.5px] leading-snug">
          This marks the issue published so members can read it.
        </p>
        <div className="border-hair mt-4 rounded-ui border-[1.5px] bg-white p-3.5">
          <div className="flex items-start gap-2">
            <FigureBadge n={1} />
            <span className="border-brass-ink bg-brass text-ground mt-px flex h-4 w-4 flex-none items-center justify-center rounded-[3px] border">
              <Icon name="check" size={10} strokeWidth={3} />
            </span>
            <span className="text-ink font-ui text-[12.5px] leading-snug font-semibold">
              Email the new issue
            </span>
          </div>
          <div className="mt-1.5 flex items-start gap-2 pl-6">
            <FigureBadge n={2} />
            <span className="text-muted font-ui text-[11.5px] leading-snug">
              Sends a personal &ldquo;Read issue&rdquo; link to 132 subscribed
              members.
            </span>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <FigureBadge n={3} />
          <span className="border-hair text-ink rounded-md border-[1.5px] bg-white px-3 py-1.5 font-ui text-[12px] font-semibold">
            Keep as draft
          </span>
          <span className="bg-brass text-ground flex items-center gap-1.5 rounded-md px-3 py-1.5 font-ui text-[12px] font-semibold">
            <Icon name="check" size={12} strokeWidth={2.5} />
            Publish &amp; send
          </span>
        </div>
      </div>
    </FigureFrame>
  );
}
