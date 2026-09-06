// The editorial masthead band: the club name as an eyebrow over the publication's
// standfirst (the tagline). This is the page's single <h1> — it lets a member
// landing on `/` say what the publication is before clicking anything.
export function Masthead({ org, tagline }: { org: string; tagline: string }) {
  return (
    <section className="border-line border-b py-10 text-center sm:py-14 relative">
      <div className="mx-auto mb-3 flex items-center justify-center gap-3">
        <span className="h-px w-12 bg-[#c49348]/40" />
        <span className="text-[#7c4a10] font-sans text-[11px] font-bold tracking-[0.24em] uppercase">
          {org} · Reading Room
        </span>
        <span className="h-px w-12 bg-[#c49348]/40" />
      </div>
      <h1 className="text-ink mx-auto mt-3 max-w-2xl font-serif text-[28px] italic leading-[1.25] text-balance sm:text-[36px]">
        &ldquo;{tagline}&rdquo;
      </h1>
    </section>
  );
}
