import type { ReactNode } from "react";

// The panel every group of settings on /admin/magazine sits in: a serif title,
// a plain-language line saying what the group is for, and the controls under
// it. Lives here rather than beside its first caller because the logo library
// (a different feature) is one of the groups — the page reads as one thing, so
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
      className="bg-card border-line scroll-mt-6 rounded-[10px] border p-6 shadow-[0_1px_3px_rgba(0,0,0,0.07)]"
    >
      <h2 className="text-ink font-serif text-[22px] leading-tight">{title}</h2>
      <p className="text-muted mt-1.5 font-sans text-[13px] leading-relaxed">
        {blurb}
      </p>
      <div className="mt-5 flex flex-col gap-5">{children}</div>
    </section>
  );
}
