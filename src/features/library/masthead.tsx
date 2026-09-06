// The editorial masthead band: the club name as an eyebrow over the publication's
// standfirst (the tagline). This is the page's single <h1> — it lets a member
// landing on `/` say what the publication is before clicking anything.
export function Masthead({ org, tagline }: { org: string; tagline: string }) {
  return (
    <section className="border-hairline border-b py-10 text-center sm:py-14">
      <div className="text-red font-ui text-[11px] font-semibold tracking-[0.24em] uppercase">
        {org}
      </div>
      <h1 className="text-lead mx-auto mt-4 max-w-2xl font-display text-[26px] leading-[1.2] text-balance sm:text-[32px]">
        {tagline}
      </h1>
    </section>
  );
}
