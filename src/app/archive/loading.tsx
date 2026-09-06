import { Wordmark } from "@/components/ui";
import { CatalogueSkeleton } from "@/features/library/catalogue-skeleton";

// Archive skeleton: header, title, the two controls and a shelf of covers. Its
// own file because the root skeleton leads with a hero this page never has.
export default function ArchiveLoading() {
  return (
    <main className="index-library mx-auto px-5 py-6 sm:px-8 sm:py-10">
      <p role="status" className="sr-only">
        Loading the archive…
      </p>
      <header className="index-library-header border-line flex items-center justify-between border-b pb-4">
        <Wordmark size={24} />
        <div className="bg-line-soft h-8 w-40 motion-safe:animate-pulse rounded-lg" />
      </header>
      <div className="pt-8 pb-2">
        <div className="bg-line-soft h-9 w-56 motion-safe:animate-pulse rounded" />
        <div className="bg-line-soft mt-4 h-4 w-72 motion-safe:animate-pulse rounded" />
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="bg-line-soft h-11 flex-1 motion-safe:animate-pulse rounded-lg" />
        <div className="bg-line-soft h-11 w-full motion-safe:animate-pulse rounded-lg sm:w-40" />
      </div>
      <CatalogueSkeleton count={8} />
    </main>
  );
}
