export function Masthead({ org, tagline }: { org: string; tagline: string }) {
  return (
    <section className="index-masthead">
      <div className="index-masthead-meta">
        <span className="text-accent">{org}</span>
        <span className="text-muted">MEMBER EDITION</span>
      </div>
      <h1>{tagline}</h1>
    </section>
  );
}
