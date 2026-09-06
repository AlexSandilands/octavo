import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";

// Building blocks for the admin guide (/admin/help): section cards, numbered
// steps, plain lists, callouts, and figure frames for the token-built
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
      className="bg-surface border-hairline shadow-card mt-5 scroll-mt-6 rounded-card border p-5 sm:p-7"
    >
      <div className="text-primary font-ui text-[13px] font-bold tracking-[0.12em] uppercase">
        {kicker}
      </div>
      <h2
        id={`${id}-heading`}
        className="text-fg mt-1.5 font-ui text-[26px] leading-tight font-bold"
      >
        {title}
      </h2>
      <div className="mt-4 space-y-5">{children}</div>
    </section>
  );
}

export function P({ children }: { children: ReactNode }) {
  return (
    <p className="text-fg max-w-[64ch] font-ui text-[17px] leading-relaxed">
      {children}
    </p>
  );
}

export function Bullets({ children }: { children: ReactNode }) {
  return (
    <ul className="text-fg marker:text-primary max-w-[64ch] list-disc space-y-2.5 pl-5 font-ui text-[17px] leading-relaxed">
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
        className="bg-primary-soft text-primary mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full font-ui text-[14px] font-bold"
      >
        {n}
      </span>
      <div className="min-w-0">
        <h3 className="text-fg font-ui text-[17px] font-bold">{title}</h3>
        <div className="text-fg-muted mt-1 font-ui text-[16px] leading-relaxed">
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
      className={`max-w-[64ch] rounded-field border-l-[5px] p-4 sm:p-5 ${
        careful
          ? "border-l-warn bg-warn-soft"
          : "border-l-primary bg-primary-wash"
      }`}
    >
      <h3
        className={`flex items-center gap-2 font-ui text-[16px] font-bold ${
          careful ? "text-warn" : "text-primary"
        }`}
      >
        {icon && <Icon name={icon} size={18} strokeWidth={2} />}
        {title}
      </h3>
      <div className="text-fg mt-1.5 font-ui text-[16px] leading-relaxed">
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
    <figure>
      <div
        aria-hidden="true"
        className="bg-ground border-hairline overflow-hidden rounded-field border p-4 sm:p-6"
      >
        {children}
      </div>
      <figcaption className="text-fg-muted mt-2 font-ui text-[15px] leading-relaxed">
        {caption}
      </figcaption>
    </figure>
  );
}

// Numbered marker inside an aria-hidden figure; pairs with the real, readable
// legend list next to the figure.
export function FigureBadge({ n }: { n: number }) {
  return (
    <span className="bg-primary text-surface flex h-5 w-5 flex-none items-center justify-center rounded-full font-ui text-[11px] font-bold">
      {n}
    </span>
  );
}
