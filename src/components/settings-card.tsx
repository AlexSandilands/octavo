import type { ReactNode } from "react";

// One group of settings on /admin/magazine: a heavy rule, a display-serif
// title, a plain-language line saying what the group is for, and the controls
// under it. The page is a single long form and the groups are separated by
// rules, not boxes. Lives here rather than beside its first caller because the
// logo library (a different feature) is one of the groups — the page reads as
// one thing, so the groups have to be one thing.
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
    <section id={id} className="rule-heavy scroll-mt-6 pt-4">
      <h2 className="text-lead font-display text-[28px] leading-tight font-semibold">
        {title}
      </h2>
      <p className="text-grey mt-2 max-w-[60ch] font-ui text-[16px] leading-relaxed">
        {blurb}
      </p>
      <div className="mt-6 flex flex-col gap-6">{children}</div>
    </section>
  );
}
