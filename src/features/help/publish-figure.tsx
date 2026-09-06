import { Icon } from "@/components/icons";
import { FigureFrame } from "./guide-ui";

// The publish → email flow as a three-stage strip, built from the site's own
// tokens. Decorative (FigureFrame hides it from screen readers); the copy in
// section-publishing.tsx states every fact shown here.

function Stage({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-hair flex min-w-0 flex-1 flex-col items-center gap-2.5 rounded-ui border bg-white px-4 py-4">
      <span className="text-faint text-center font-meta text-[11px] font-medium tracking-[0.14em] uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}

export function PublishFigure() {
  return (
    <FigureFrame caption="Publishing, step by step: pressing Publish opens a confirmation window. Only if the email box is ticked there does the site email subscribed members — each message carrying that member's own reading link.">
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <Stage label="You press">
          <span className="bg-brass text-ground rounded-md px-4 py-2 font-ui text-[13px] font-semibold">
            Publish
          </span>
        </Stage>
        <span className="text-faint2 flex flex-none justify-center">
          <Icon name="arrowDown" size={16} className="sm:hidden" />
          <Icon name="arrowRight" size={16} className="hidden sm:block" />
        </span>
        <Stage label="The site asks">
          <span className="border-line w-full rounded-md border p-2.5">
            <span className="text-ink block font-display text-[13px] leading-tight">
              Publish issue No. 4?
            </span>
            <span className="mt-2 flex items-start gap-2">
              <span className="border-brass-ink bg-brass text-ground flex h-3.5 w-3.5 flex-none items-center justify-center rounded-[3px] border">
                <Icon name="check" size={9} strokeWidth={3} />
              </span>
              <span className="text-body font-ui text-[10.5px] leading-snug font-semibold">
                Email the new issue
              </span>
            </span>
          </span>
        </Stage>
        <span className="text-faint2 flex flex-none justify-center">
          <Icon name="arrowDown" size={16} className="sm:hidden" />
          <Icon name="arrowRight" size={16} className="hidden sm:block" />
        </span>
        <Stage label="Only if ticked">
          <span className="flex items-center gap-2">
            <Icon name="mail" size={17} className="text-brass-ink" />
            <span className="text-body font-ui text-[11.5px] leading-snug">
              Every <strong>subscribed</strong> member gets a personal
              “Read&nbsp;issue” link
            </span>
          </span>
        </Stage>
      </div>
    </FigureFrame>
  );
}
