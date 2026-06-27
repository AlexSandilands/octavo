export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <p className="text-[var(--color-muted)] text-sm tracking-wide uppercase">
        Club Magazine
      </p>
      <h1 className="mt-3 font-serif text-4xl">Skeleton is up.</h1>
      <p className="text-[var(--color-muted)] mt-4 max-w-prose">
        Next steps live in <code>docs/SPEC.md</code>. Build order is in the
        roadmap. This placeholder will become the issue library.
      </p>
    </main>
  );
}
