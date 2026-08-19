import { Wordmark } from "@/components/ui";

// Archive skeleton: header, title, the two controls and a shelf of covers. Its
// own file because the root skeleton leads with a hero this page never has.
export default function ArchiveLoading() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-6 sm:px-8 sm:py-10">
      <header className="border-line flex items-center justify-between border-b pb-4">
        <Wordmark size={24} />
        <div className="bg-line-soft h-8 w-40 animate-pulse rounded-lg" />
      </header>
      <div className="pt-8 pb-2">
        <div className="bg-line-soft h-9 w-56 animate-pulse rounded" />
        <div className="bg-line-soft mt-4 h-4 w-72 animate-pulse rounded" />
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="bg-line-soft h-11 flex-1 animate-pulse rounded-lg" />
        <div className="bg-line-soft h-11 w-full animate-pulse rounded-lg sm:w-40" />
      </div>
      <div className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i}>
            <div className="bg-line-soft aspect-[5/7] animate-pulse rounded-[4px]" />
            <div className="bg-line-soft mt-3 h-4 w-3/4 animate-pulse rounded" />
          </div>
        ))}
      </div>
    </main>
  );
}
