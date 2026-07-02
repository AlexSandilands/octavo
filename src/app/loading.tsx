import { Wordmark } from "@/components/ui";

// Library skeleton: header + hero cover + archive shelf, so a slow database
// shows the page taking shape instead of a blank screen.
export default function LibraryLoading() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-6 sm:px-8 sm:py-10">
      <header className="border-line flex items-center justify-between border-b pb-4">
        <Wordmark size={24} />
        <div className="bg-line-soft h-8 w-40 animate-pulse rounded-lg" />
      </header>
      <section className="mt-10 flex flex-col gap-10 sm:flex-row">
        <div className="bg-line-soft aspect-[5/7] w-full max-w-[320px] flex-none animate-pulse rounded-[4px]" />
        <div className="flex-1 pt-4">
          <div className="bg-line-soft h-4 w-28 animate-pulse rounded" />
          <div className="bg-line-soft mt-5 h-10 w-3/4 animate-pulse rounded" />
          <div className="bg-line-soft mt-4 h-4 w-1/2 animate-pulse rounded" />
          <div className="bg-line-soft mt-10 h-4 w-24 animate-pulse rounded" />
          <div className="mt-4 space-y-3">
            <div className="bg-line-soft h-5 w-2/3 animate-pulse rounded" />
            <div className="bg-line-soft h-5 w-1/2 animate-pulse rounded" />
            <div className="bg-line-soft h-5 w-3/5 animate-pulse rounded" />
          </div>
        </div>
      </section>
      <section className="mt-16 grid grid-cols-2 gap-6 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i}>
            <div className="bg-line-soft aspect-[5/7] animate-pulse rounded-[4px]" />
            <div className="bg-line-soft mt-3 h-4 w-3/4 animate-pulse rounded" />
          </div>
        ))}
      </section>
    </main>
  );
}
