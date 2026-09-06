/** The compact cover-and-title rows shared by Index's loading states. */
export function CatalogueSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="mt-10 grid gap-x-8 sm:grid-cols-2" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="border-line flex gap-5 border-t py-6">
          <div className="bg-line-soft h-32 w-[92px] flex-none motion-safe:animate-pulse" />
          <div className="flex-1 pt-3">
            <div className="bg-line-soft h-3 w-20 motion-safe:animate-pulse" />
            <div className="bg-line-soft mt-4 h-6 w-4/5 motion-safe:animate-pulse" />
            <div className="bg-line-soft mt-4 h-4 w-24 motion-safe:animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
