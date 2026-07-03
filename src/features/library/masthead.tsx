import { site } from "@/lib/site";

// The editorial masthead band: the club name as an eyebrow over the publication's
// standfirst (site.tagline). This is the page's single <h1> — it lets a member
// landing on `/` say what the publication is before clicking anything.
export function Masthead() {
  return (
    <section className="border-line border-b py-10 text-center sm:py-14">
      <div className="text-accent font-sans text-[11px] font-semibold tracking-[0.24em] uppercase">
        {site.org}
      </div>
      <h1 className="text-ink mx-auto mt-4 max-w-2xl font-serif text-[26px] leading-[1.2] text-balance sm:text-[32px]">
        {site.tagline}
      </h1>
    </section>
  );
}
