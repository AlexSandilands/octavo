// The small "Demo" chip an anonymous visitor sees on a demo deployment
// (issue #50) — it replaces the signed-in account affordances, so a visitor
// knows this is a public showcase where sign-in and email features are off.
// Callers render it only when the member gate returned no user, which can
// only happen in demo mode; the chip itself stays a dumb presentational span.
export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      className={`border-hair text-muted bg-card inline-block rounded-full border px-3 py-1 font-sans text-xs font-medium tracking-wide uppercase${className ? ` ${className}` : ""}`}
    >
      Demo
      <span className="sr-only">
        {" "}
        — public showcase; sign-in and email features are disabled
      </span>
    </span>
  );
}
