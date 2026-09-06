import type { ReactNode } from "react";

// The panel every group of settings on /admin/magazine sits in: a display
// title, a plain-language line saying what the group is for, and the controls
// under it. A card on the sheet — a hairline and the lighter card fill. Lives
// here rather than beside its first caller because the logo library (a
// different feature) is one of the groups — the page reads as one thing, so
// the panels have to be one thing.
export function SettingsCard({
  id,
  title,
  blurb,
  children,
}: {
  /** Anchor target, for links that point at a particular group. */
  id?: string;
  title: string;
  blurb: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="bg-card border-hair-warm rounded-sheet shadow-flat scroll-mt-6 border p-6"
    >
      <h2 className="text-ink font-display text-[24px] leading-tight">
        {title}
      </h2>
      <p className="text-muted mt-1.5 font-ui text-[14px] leading-relaxed">
        {blurb}
      </p>
      <div className="mt-5 flex flex-col gap-5">{children}</div>
    </section>
  );
}
