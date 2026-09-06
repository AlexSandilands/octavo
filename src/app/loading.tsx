import { Wordmark } from "@/components/ui";
import { CatalogueSkeleton } from "@/features/library/catalogue-skeleton";

export default function LibraryLoading() {
  return (
    <main
      className="index-library mx-auto px-5 py-6 sm:px-8 sm:py-8"
      aria-busy="true"
    >
      <p role="status" className="sr-only">
        Loading the library…
      </p>
      <header className="index-library-header flex items-center justify-between pb-4">
        <Wordmark size={24} />
        <div className="bg-line-soft h-11 w-24 motion-safe:animate-pulse" />
      </header>
      <div className="border-ink border-b-2 py-12" aria-hidden="true">
        <div className="bg-line-soft h-14 w-4/5 motion-safe:animate-pulse" />
        <div className="bg-line-soft mt-4 h-14 w-3/5 motion-safe:animate-pulse" />
      </div>
      <section className="index-latest" aria-hidden="true">
        <div className="index-latest-intro">
          <div className="bg-line-soft h-10 w-3/4 motion-safe:animate-pulse" />
          <div className="bg-line-soft mt-5 h-4 w-1/2 motion-safe:animate-pulse" />
          <div className="bg-line-soft mt-6 h-12 w-40 motion-safe:animate-pulse" />
        </div>
        <div className="index-latest-cover">
          <div className="bg-line-soft h-80 w-60 motion-safe:animate-pulse" />
        </div>
        <div className="index-latest-contents space-y-5">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="bg-line-soft h-5 w-3/4 motion-safe:animate-pulse"
            />
          ))}
        </div>
      </section>
      <CatalogueSkeleton />
    </main>
  );
}
