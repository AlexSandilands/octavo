import { Skeleton } from "@/components/skeleton";

// Library skeleton: the masthead's rules, a headline band and a run of back-
// issue rows, so a slow database shows the page taking shape.
export default function LibraryLoading() {
  return (
    <main
      className="mx-auto max-w-5xl px-5 pt-4 pb-10 sm:px-8"
      role="status"
      aria-busy
      aria-label="Loading the library"
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
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-4 h-12 w-3/4" />
        <Skeleton className="mt-4 h-4 w-52" />
      </div>
      <div className="rule-heavy mt-6 grid gap-8 pt-6 md:grid-cols-[300px_1fr] md:gap-12">
        <Skeleton className="h-[420px] w-full max-w-[300px]" />
        <div className="space-y-4 pt-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-6 w-3/5" />
        </div>
      </div>
      <div className="rule-heavy mt-10 space-y-0 pt-4">
        {Array.from({ length: 4 }, (_, i) => (
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
