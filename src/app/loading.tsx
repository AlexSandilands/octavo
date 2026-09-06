import { Wordmark } from "@/components/ui";

// Library skeleton: bar + masthead + hero cover + shelf, so a slow database
// shows the page taking shape instead of a blank screen.
export default function LibraryLoading() {
  return (
    <>
      <header className="border-hairline bg-raised border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Wordmark size={24} tone="dark" />
          <div className="skeleton h-9 w-40" />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="border-hairline flex flex-col items-center border-b py-12 sm:py-16">
          <div className="skeleton h-3 w-32" />
          <div className="skeleton mt-5 h-8 w-2/3 max-w-lg" />
        </div>
        <section className="grid gap-10 py-12 md:grid-cols-[260px_1fr] md:gap-14 md:py-16">
          <div className="skeleton mx-auto aspect-[640/900] w-[260px] md:mx-0" />
          <div className="pt-2">
            <div className="skeleton h-3 w-28" />
            <div className="skeleton mt-5 h-11 w-3/4" />
            <div className="skeleton mt-4 h-4 w-1/2" />
            <div className="skeleton mt-10 h-3 w-24" />
            <div className="mt-4 space-y-3">
              <div className="skeleton h-5 w-2/3" />
              <div className="skeleton h-5 w-1/2" />
              <div className="skeleton h-5 w-3/5" />
            </div>
          </div>
        </section>
        <div className="mt-4 flex gap-6 overflow-hidden">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="w-[150px] flex-none">
              <div className="skeleton aspect-[640/900] w-full" />
              <div className="skeleton mt-3.5 h-4 w-3/4" />
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
