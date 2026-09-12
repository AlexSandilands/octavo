// A small label pinned to a stage's top-left corner naming what is on it —
// "Magazine" over the canvas, "PDF" over the import panel — so the two
// side-by-side pages are never confused for each other.
export function StageBadge({ children }: { children: string }) {
  return (
    <span className="border-hair-warm text-muted pointer-events-none absolute top-3 left-3 z-20 rounded-full border bg-white px-3 py-1 font-sans text-[11px] font-semibold tracking-[0.14em] uppercase shadow-[0_4px_14px_rgba(40,36,28,0.12)]">
      {children}
    </span>
  );
}
