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
    <div className="border-hair flex min-w-0 flex-1 flex-col items-center gap-2 rounded-lg border bg-white px-3 py-3.5">
      <span className="text-faint text-center font-sans text-[9px] font-semibold tracking-[0.14em] uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}

export function PublishFigure() {
  return (
    <FigureFrame caption="Publishing, step by step: pressing Publish opens a confirmation window. Only if the email box is ticked there does the site email subscribed members — each message carrying that member's own reading link.">
      <div className="flex flex-col items-stretch gap-1.5 sm:flex-row sm:items-center">
        <Stage label="You press">
          <span className="bg-accent text-paper rounded-md px-3 py-1.5 font-sans text-[11px] font-semibold">
            Publish
          </span>
        </Stage>
        <span className="text-faint2 flex flex-none justify-center">
          <Icon name="arrowDown" size={14} className="sm:hidden" />
          <Icon name="arrowRight" size={14} className="hidden sm:block" />
        </span>
        <Stage label="The site asks">
          <span className="border-line w-full rounded-md border p-2">
            <span className="text-ink block font-serif text-[11px] leading-tight">
              Publish issue No. 4?
            </span>
            <span className="mt-1.5 flex items-start gap-1.5">
              <span className="border-accent bg-accent text-paper flex h-3 w-3 flex-none items-center justify-center rounded-[3px] border">
                <Icon name="check" size={8} strokeWidth={3} />
              </span>
              <span className="text-body font-sans text-[9px] leading-snug font-semibold">
                Email the new issue
              </span>
            </span>
          </span>
        </Stage>
        <span className="text-faint2 flex flex-none justify-center">
          <Icon name="arrowDown" size={14} className="sm:hidden" />
          <Icon name="arrowRight" size={14} className="hidden sm:block" />
        </span>
        <Stage label="Only if ticked">
          <span className="flex items-center gap-1.5">
            <Icon name="mail" size={15} className="text-accent" />
            <span className="text-body font-sans text-[10px] leading-snug">
              Every <strong>subscribed</strong> member gets a personal
              “Read&nbsp;issue” link
            </span>
          </span>
        </Stage>
      </div>
    </FigureFrame>
  );
}
