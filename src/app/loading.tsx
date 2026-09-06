import { Wordmark } from "@/components/ui";

export default function LibraryLoading() {
  return (
    <main
      className="harbour-library"
      aria-busy="true"
      aria-label="Loading library"
    >
      <header className="border-line flex items-center justify-between border-b pb-5">
        <Wordmark size={24} />
        <span className="bg-line h-10 w-32 animate-pulse rounded-full" />
      </header>
      <div className="harbour-library-layout">
        <aside
          aria-hidden="true"
          className="bg-accent h-64 animate-pulse rounded-[24px] md:h-[460px]"
        />
        <div className="min-w-0">
          <div className="harbour-latest min-h-[470px]" aria-hidden="true">
            <div className="space-y-5">
              <div className="bg-line h-4 w-32 animate-pulse rounded" />
              <div className="bg-line h-12 w-full animate-pulse rounded-xl" />
              <div className="bg-line h-6 w-2/3 animate-pulse rounded" />
              <div className="bg-line mt-10 h-36 animate-pulse rounded-xl" />
            </div>
            <div className="bg-line aspect-[5/7] w-[240px] animate-pulse rounded-xl" />
          </div>
          <div className="mt-8 flex flex-wrap gap-4" aria-hidden="true">
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="bg-white border-line h-64 w-[190px] animate-pulse rounded-[18px] border"
              />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
