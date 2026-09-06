// The editorial masthead band: the club name as an eyebrow over the publication's
// standfirst (the tagline). This is the page's single <h1> — it lets a member
// landing on `/` say what the publication is before clicking anything.
export function Masthead({ org, tagline }: { org: string; tagline: string }) {
  return (
    <section className="border-line/70 border-b py-10 text-center sm:py-14">
      <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3.5 py-1 text-accent font-sans text-[11px] font-bold tracking-[0.16em] uppercase">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        {org}
      </div>
      <h1 className="text-ink mx-auto mt-4 max-w-2xl font-sans text-[28px] font-bold tracking-tight leading-[1.15] text-balance sm:text-[38px]">
        {tagline}
      </h1>
    </section>
  );
}
