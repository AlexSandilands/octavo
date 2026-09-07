import { Icon } from "@/components/icons";
import { FigureBadge, FigureFrame, MiniButton } from "./guide-ui";

// A close-up mock of the publish confirmation window (publish-modal.tsx),
// built from the site's tokens. Decorative (FigureFrame hides it from screen
// readers); the numbered legend in section-publishing.tsx carries the meaning.
export function PublishModalFigure() {
  return (
    <FigureFrame caption="The confirmation window up close. The numbers match the list below.">
      <div className="bg-sheet border-lead mx-auto w-full max-w-[440px] border-t-[3px] p-5 sm:p-6">
        <div className="text-red font-ui text-[9.5px] font-semibold tracking-[0.14em] uppercase">
          Publish &amp; send
        </div>
        <div className="text-lead mt-2 font-display text-[21px] leading-tight font-semibold">
          Publish issue No. 4?
        </div>
        <p className="text-grey mt-1.5 font-ui text-[12.5px] leading-snug">
          This marks the issue published so members can read it.
        </p>
        <div className="border-lead mt-4 border p-3.5">
          <div className="flex items-start gap-2">
            <FigureBadge n={1} />
            <span className="border-lead bg-lead text-sheet mt-px flex h-4 w-4 flex-none items-center justify-center border">
              <Icon name="check" size={10} strokeWidth={3} />
            </span>
            <span className="text-lead font-ui text-[12.5px] leading-snug font-semibold">
              Email the new issue
            </span>
          </div>
          <div className="mt-1.5 flex items-start gap-2 pl-6">
            <FigureBadge n={2} />
            <span className="text-grey font-ui text-[11.5px] leading-snug">
              Sends a personal &ldquo;Read issue&rdquo; link to 132 subscribed
              members.
            </span>
          </div>
        </div>
        <div className="border-lead mt-4 flex items-center justify-end gap-2 border-t-[3px] pt-3">
          <FigureBadge n={3} />
          <MiniButton>Keep as draft</MiniButton>
          <MiniButton primary>
            <Icon name="check" size={12} strokeWidth={2.5} />
            Publish &amp; send
          </MiniButton>
        </div>
      </div>
    </FigureFrame>
  );
}
