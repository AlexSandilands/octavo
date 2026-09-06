import { MagazineName } from "@/components/branding";

export function Masthead({ org, tagline }: { org: string; tagline: string }) {
  return (
    <section className="folio-masthead">
      <div className="folio-masthead-meta">
        <span>{org}</span>
        <span>A journal for our members</span>
      </div>
      <h1>
        <MagazineName />
      </h1>
      <p>{tagline}</p>
    </section>
  );
}
