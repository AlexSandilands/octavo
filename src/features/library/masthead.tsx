import { Kicker } from "@/components/ui";

// The editorial masthead band: the club name as an eyebrow over the
// publication's standfirst (the tagline), lit on the dark ground. This is the
// page's single <h1> — it lets a member landing on `/` say what the
// publication is before clicking anything.
export function Masthead({ org, tagline }: { org: string; tagline: string }) {
  return (
    <section className="border-hairline border-b py-12 text-center sm:py-16">
      <Kicker tone="dark">{org}</Kicker>
      <h1 className="text-chrome-text mx-auto mt-4 max-w-2xl font-display text-[28px] leading-[1.2] text-balance sm:text-[38px]">
        {tagline}
      </h1>
    </section>
  );
}
