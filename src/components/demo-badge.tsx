// The small "Demo" label an anonymous visitor sees on a demo deployment
// (issue #50) — it replaces the signed-in account affordances, so a visitor
// knows this is a public showcase where sign-in and email features are off.
// Callers render it only when the member gate returned no user, which can
// only happen in demo mode; the label itself stays a dumb presentational span.
export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      className={`small-caps border-lead bg-sheet text-lead inline-flex h-7 items-center border px-2${className ? ` ${className}` : ""}`}
    >
      Demo
      <span className="sr-only">
        {" "}
        — public showcase; sign-in and email features are disabled
      </span>
    </span>
  );
}
