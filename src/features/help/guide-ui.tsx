import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";

// Building blocks for the admin guide (/admin/help): section scaffolding,
// numbered steps, plain lists, callouts, and figure frames for the token-built
// illustrations. Everything here is server-rendered and static.

export function GuideSection({
  id,
  kicker,
  title,
  children,
}: {
  id: string;
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="border-line-soft mt-10 scroll-mt-8 border-t pt-8"
    >
      <div className="text-accent font-sans text-[11px] font-semibold tracking-[0.2em] uppercase">
        {kicker}
      </div>
      <h2
        id={`${id}-heading`}
        className="text-ink mt-1.5 font-serif text-[26px] leading-tight"
      >
        {title}
      </h2>
      <div className="mt-4 space-y-5">{children}</div>
    </section>
  );
}

export function P({ children }: { children: ReactNode }) {
  return (
    <p className="text-body max-w-[64ch] font-sans text-[15.5px] leading-relaxed">
      {children}
    </p>
  );
}

export function Bullets({ children }: { children: ReactNode }) {
  return (
    <ul className="text-body max-w-[64ch] list-disc space-y-2.5 pl-5 font-sans text-[15px] leading-relaxed marker:text-faint2">
      {children}
    </ul>
  );
}

export function Steps({ children }: { children: ReactNode }) {
  return <ol className="max-w-[64ch] space-y-5">{children}</ol>;
}

export function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3.5">
      {/* Decorative — the <ol> already conveys the position. */}
      <span
        aria-hidden="true"
        className="bg-tint text-accent mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full font-sans text-[13px] font-semibold"
      >
        {n}
      </span>
      <div className="min-w-0">
        <h3 className="text-ink font-sans text-[15.5px] font-semibold">
          {title}
        </h3>
        <div className="text-body mt-1 font-sans text-[15px] leading-relaxed">
          {children}
        </div>
      </div>
    </li>
  );
}

export function Callout({
  tone = "note",
  icon,
  title,
  children,
}: {
  tone?: "note" | "careful";
  icon?: IconName;
  title: string;
  children: ReactNode;
}) {
  const careful = tone === "careful";
  return (
    <div
      className={`max-w-[64ch] rounded-[10px] border-[1.5px] p-4 sm:p-5 ${
        careful ? "border-warn bg-warn-soft" : "border-line bg-card"
      }`}
    >
      <h3
        className={`flex items-center gap-2 font-sans text-[14.5px] font-bold ${
          careful ? "text-warn" : "text-ink"
        }`}
      >
        {icon && <Icon name={icon} size={17} strokeWidth={1.8} />}
        {title}
      </h3>
      <div className="text-body mt-1.5 font-sans text-[14.5px] leading-relaxed">
        {children}
      </div>
    </div>
  );
}

// Frame for the token-built illustrations. The drawing itself is decorative
// (aria-hidden); the figcaption — and the numbered legend in the surrounding
// section — carry the meaning for screen readers.
export function FigureFrame({
  caption,
  children,
}: {
  caption: string;
  children: ReactNode;
}) {
  return (
    // On large screens the drawing bleeds wider than the text column (the
    // prose keeps its readable measure; the visual gets the room). The
    // caption keeps the column's alignment via matching padding.
    <figure className="xl:-mx-24">
      <div
        aria-hidden="true"
        className="border-line bg-card overflow-hidden rounded-[10px] border p-4 sm:p-6"
      >
        {children}
      </div>
      <figcaption className="text-faint mt-2 font-sans text-[13px] leading-relaxed xl:px-24">
        {caption}
      </figcaption>
    </figure>
  );
}

// Numbered marker inside an aria-hidden figure; pairs with the real, readable
// legend list next to the figure.
export function FigureBadge({ n }: { n: number }) {
  return (
    <span className="bg-accent text-paper flex h-[19px] w-[19px] flex-none items-center justify-center rounded-full font-sans text-[11px] font-bold">
      {n}
    </span>
  );
}
