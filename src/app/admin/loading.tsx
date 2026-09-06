// Admin skeleton: the sheet's header row + list rows on the dark ground.
// Covers /admin and its child routes (members, sponsors, editor) while their
// data loads.
export default function AdminLoading() {
  return (
    <div className="bg-ground flex min-h-screen md:p-7">
      <div className="bg-paper w-full p-7 sm:p-8 md:rounded-sheet">
        <div className="flex items-center justify-between">
          <div>
            <div className="bg-line-soft h-9 w-40 animate-pulse rounded" />
            <div className="bg-line-soft mt-3 h-4 w-56 animate-pulse rounded" />
          </div>
          <div className="bg-line-soft rounded-ui h-12 w-44 animate-pulse" />
        </div>
        <div className="mt-8 space-y-0">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className="border-line-soft flex items-center gap-5 border-b py-4"
            >
              <div className="bg-line-soft h-[60px] w-[46px] flex-none animate-pulse rounded-[3px]" />
              <div className="min-w-0 flex-1">
                <div className="bg-line-soft h-5 w-1/3 animate-pulse rounded" />
                <div className="bg-line-soft mt-2 h-4 w-20 animate-pulse rounded" />
              </div>
              <div className="bg-line-soft h-7 w-24 animate-pulse rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
