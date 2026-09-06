import { Chip } from "@/components/ui";

// The library opens with a hello: the member's first name and what the
// magazine is. This is the page's single <h1>.
export function GreetingCard({
  name,
  org,
  tagline,
}: {
  /** The member's display name, or null for an anonymous demo visitor. */
  name: string | null;
  org: string;
  tagline: string;
}) {
  const first = name?.trim().split(/\s+/)[0];
  return (
    <section className="bg-surface border-hairline shadow-card rounded-card border p-5 sm:p-7">
      <Chip tone="primary">{org}</Chip>
      <h1 className="text-fg mt-3 font-ui text-[28px] leading-tight font-bold sm:text-[34px]">
        {first ? `Welcome back, ${first}` : "Welcome"}
      </h1>
      <p className="text-fg-muted mt-2 max-w-2xl font-ui text-[17px] leading-relaxed text-balance sm:text-[18px]">
        {tagline}
      </p>
    </section>
  );
}
