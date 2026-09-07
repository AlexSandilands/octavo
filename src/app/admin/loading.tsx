// Admin skeleton: header row + issue list rows. Covers /admin and its child
// routes (members, sponsors, editor) while their data loads.
export default function AdminLoading() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="bg-hairline h-9 w-40 animate-pulse rounded-ui" />
          <div className="bg-hairline mt-3 h-4 w-56 animate-pulse rounded-ui" />
        </div>
        <div className="bg-hairline h-12 w-44 animate-pulse rounded-ui" />
      </div>
      <div className="mt-8 space-y-0">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="border-hairline flex items-center gap-5 border-b py-4"
          >
            <div className="bg-hairline h-[60px] w-[46px] flex-none animate-pulse rounded-ui" />
            <div className="min-w-0 flex-1">
              <div className="bg-hairline h-5 w-1/3 animate-pulse rounded-ui" />
              <div className="bg-hairline mt-2 h-4 w-20 animate-pulse rounded-ui" />
            </div>
            <div className="bg-hairline h-7 w-24 animate-pulse" />
          </div>
        ))}
      </div>
    </main>
  );
}
