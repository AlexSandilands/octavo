// The small "Demo" chip an anonymous visitor sees on a demo deployment
// (issue #50) — it replaces the signed-in account affordances, so a visitor
// knows this is a public showcase where sign-in and email features are off.
// Callers render it only when the member gate returned no user, which can
// only happen in demo mode; the chip itself stays a dumb presentational span.
export function DemoBadge({ className }: { className?: string }) {
  return (
    <span
      className={`border-edge text-fg-muted bg-surface inline-flex h-8 items-center rounded-full border px-3 font-ui text-[13px] font-bold tracking-[0.08em] uppercase${className ? ` ${className}` : ""}`}
    >
      Demo
      <span className="sr-only">
        {" "}
        — public showcase; sign-in and email features are disabled
      </span>
    </span>
  );
}
