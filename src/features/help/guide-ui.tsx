import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";

// Building blocks for the admin guide (/admin/help), set as a broadsheet
// article: section scaffolding under heavy rules, numbered steps, plain lists,
// boxed notices, and rule-bounded figure frames for the token-built
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
      className="rule-heavy mt-12 scroll-mt-8 pt-4"
    >
      <div className="small-caps text-red">{kicker}</div>
      <h2
        id={`${id}-heading`}
        className="text-lead mt-2 font-display text-[32px] leading-tight font-semibold text-balance"
      >
        {title}
      </h2>
      <div className="mt-5 space-y-6">{children}</div>
    </section>
  );
}

export function P({ children }: { children: ReactNode }) {
  return (
    <p className="text-lead max-w-[62ch] font-ui text-[17px] leading-relaxed">
      {children}
    </p>
  );
}

export function Bullets({ children }: { children: ReactNode }) {
  return (
    <ul className="text-lead max-w-[62ch] list-disc space-y-2.5 pl-5 font-ui text-[17px] leading-relaxed marker:text-grey-soft">
      {children}
    </ul>
  );
}

export function Steps({ children }: { children: ReactNode }) {
  return <ol className="max-w-[62ch] space-y-5">{children}</ol>;
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
    <li className="rule-hair flex gap-4 pt-4">
      {/* Decorative — the <ol> already conveys the position. */}
      <span
        aria-hidden="true"
        className="text-lead w-7 flex-none pt-0.5 font-display text-[22px] leading-none font-bold tabular-nums"
      >
        {n}.
      </span>
      <div className="min-w-0">
        <h3 className="text-lead font-display text-[21px] leading-tight font-semibold">
          {title}
        </h3>
        <div className="text-lead mt-1.5 font-ui text-[17px] leading-relaxed">
          {children}
        </div>
      </div>
    </li>
  );
}

// A boxed notice with a rule down its left edge: ink for a note, red where
// care is needed.
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
      className={`border-hairline-strong max-w-[62ch] border border-l-4 p-4 sm:p-5 ${
        careful ? "border-l-red" : "border-l-lead"
      }`}
    >
      <h3
        className={`flex items-center gap-2 font-ui text-[16px] font-bold ${
          careful ? "text-red" : "text-lead"
        }`}
      >
        {icon && <Icon name={icon} size={17} strokeWidth={1.8} />}
        {title}
      </h3>
      <div className="text-lead mt-1.5 font-ui text-[16px] leading-relaxed">
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
    <figure className="xl:-mx-20">
      <div
        aria-hidden="true"
        className="border-lead bg-newsprint overflow-hidden border p-4 sm:p-6"
      >
        {children}
      </div>
      <figcaption className="rule-hair text-grey mt-0 pt-2 font-ui text-[15px] leading-relaxed xl:px-20">
        {caption}
      </figcaption>
    </figure>
  );
}

// Numbered marker inside an aria-hidden figure; pairs with the real, readable
// legend list next to the figure.
export function FigureBadge({ n }: { n: number }) {
  return (
    <span className="bg-red text-sheet flex h-[19px] w-[19px] flex-none items-center justify-center rounded-full font-ui text-[11px] font-bold">
      {n}
    </span>
  );
}

// Miniature chrome for the figures, drawn once so the six sketches stay in
// step with each other and with the real controls they stand for.
export function MiniButton({
  children,
  primary = false,
}: {
  children: ReactNode;
  primary?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-ui border px-2.5 py-1 font-ui text-[11.5px] font-semibold whitespace-nowrap ${
        primary
          ? "border-red bg-red text-sheet"
          : "border-lead bg-sheet text-lead"
      }`}
    >
      {children}
    </span>
  );
}

export function MiniLink({ children }: { children: ReactNode }) {
  return (
    <span className="text-red font-ui text-[11px] font-semibold underline underline-offset-2">
      {children}
    </span>
  );
}

export function MiniStatus({ children }: { children: ReactNode }) {
  return (
    <span className="border-lead text-lead inline-flex h-5 items-center border px-1.5 font-ui text-[9px] font-semibold tracking-[0.1em] uppercase">
      {children}
    </span>
  );
}

export function MiniSelect({ children }: { children: ReactNode }) {
  return (
    <span className="border-lead text-lead bg-sheet inline-flex h-[22px] items-center gap-1 rounded-ui border px-2 font-ui text-[9.5px] font-medium whitespace-nowrap">
      {children}
      <Icon name="chevronDown" size={9} strokeWidth={2} />
    </span>
  );
}
