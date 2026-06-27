import Link from "next/link";
import { Button, Kicker, Label } from "@/components/ui";
import { site } from "@/lib/site";
import type { IssueContent } from "@/lib/blocks";
import { issueMonth, issueSections } from "./contents";

type LatestIssueProps = {
  number: number;
  title: string;
  content: IssueContent;
  publishedAt: Date | null;
};

// The library hero: the cover as a physical object on the left, and an editorial
// "in this issue" teaser on the right so the latest issue sells itself.
export function LatestIssue({
  number,
  title,
  content,
  publishedAt,
}: LatestIssueProps) {
  const pageCount = content.pages.length;
  const month = issueMonth(publishedAt);
  const sections = issueSections(content);
  const shown = sections.slice(0, 4);

  return (
    <section className="border-line-soft grid gap-8 border-b py-9 md:grid-cols-[240px_1fr]">
      <Link
        href={`/read/${number}`}
        aria-label={`Read ${title}`}
        className="group relative block h-[330px]"
      >
        {/* Stacked page edges peeking out behind the cover. */}
        <div className="absolute inset-y-2 -right-[3px] w-[3px] rounded-r-[3px] bg-[#ded7c7]" />
        <div className="absolute inset-y-1 -right-[6px] w-[3px] rounded-r-[3px] bg-[#ece6d8]" />
        <div className="photo-fill-green relative flex h-full flex-col justify-between overflow-hidden rounded-[5px] p-5 shadow-[0_18px_38px_-14px_rgba(20,40,33,0.55)] transition-transform duration-300 group-hover:-translate-y-1">
          {/* Spine: a darker strip and a hairline highlight down the binding. */}
          <div className="absolute inset-y-0 left-0 w-[7px] bg-black/20" />
          <div className="absolute inset-y-0 left-[7px] w-px bg-white/10" />
          <div className="text-cream font-serif text-[13px] tracking-[0.1em]">
            {site.name} · No. {number}
          </div>
          <div className="text-paper font-serif text-4xl leading-[0.96]">
            {title}
          </div>
        </div>
      </Link>

      <div className="flex flex-col">
        <Kicker>The latest issue</Kicker>
        <h1 className="text-ink mt-3 font-serif text-4xl leading-[1.02] sm:text-5xl">
          {title}
        </h1>
        <div className="text-faint mt-3 font-sans text-[13px] tracking-wide">
          No. {number} · {pageCount} {pageCount === 1 ? "page" : "pages"}
          {month ? ` · ${month}` : ""}
        </div>

        {shown.length > 0 && (
          <div className="border-line-soft mt-6 border-t pt-5">
            <Label>In this issue</Label>
            <ol className="mt-3">
              {shown.map((s, i) => (
                <li
                  key={i}
                  className="border-line-soft/70 flex items-baseline gap-3 border-b py-2.5 last:border-0"
                >
                  <span className="text-accent/70 w-5 flex-none font-mono text-[11px] tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-ink font-serif text-[17px] leading-snug">
                    {s.title}
                  </span>
                  {s.kicker && (
                    <span className="text-faint ml-auto flex-none pl-3 font-sans text-[10px] tracking-[0.18em] uppercase">
                      {s.kicker}
                    </span>
                  )}
                </li>
              ))}
            </ol>
            {sections.length > shown.length && (
              <div className="text-faint2 mt-2.5 font-serif text-sm italic">
                + {sections.length - shown.length} more
              </div>
            )}
          </div>
        )}

        <div className="mt-auto flex flex-wrap gap-3 pt-7">
          <Button href={`/read/${number}`} icon="arrowRight">
            Read this issue
          </Button>
          <Button variant="secondary" icon="download">
            PDF
          </Button>
        </div>
      </div>
    </section>
  );
}
