import { Skeleton } from "@/components/skeleton";

// Archive skeleton: masthead rules, the title, the two fields and a run of
// rows. Its own file because the root skeleton leads with a front page this
// page never has.
export default function ArchiveLoading() {
  return (
    <main
      className="mx-auto max-w-5xl px-5 pt-4 pb-10 sm:px-8"
      role="status"
      aria-busy
      aria-label="Loading the archive"
    >
      <div className="rule-hair flex h-11 items-center justify-between">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="flex flex-col items-center py-7">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="mt-4 h-3 w-80" />
      </div>
      <div className="rule-heavy rule-hair flex h-12 items-center gap-6">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="pt-8">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="mt-4 h-4 w-72" />
      </div>
      <div className="rule-heavy mt-6 flex flex-col gap-3 pt-4 sm:flex-row">
        <Skeleton className="h-11 flex-1" />
        <Skeleton className="h-11 w-full sm:w-40" />
      </div>
      <div className="mt-8 space-y-0">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="rule-hair flex items-center gap-5 py-3">
            <Skeleton className="h-[101px] w-[72px] flex-none" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
