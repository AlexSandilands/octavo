import { Wordmark } from "@/components/ui";

// Archive skeleton: bar, title, the two controls and a shelf of covers. Its
// own file because the root skeleton leads with a hero this page never has.
export default function ArchiveLoading() {
  return (
    <>
      <header className="border-hairline bg-raised border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Wordmark size={24} tone="dark" />
          <div className="skeleton h-9 w-40" />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="pt-10 pb-2 sm:pt-14">
          <div className="skeleton h-10 w-56" />
          <div className="skeleton mt-4 h-4 w-72" />
        </div>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="skeleton h-11 flex-1" />
          <div className="skeleton h-11 w-full sm:w-40" />
        </div>
        <div className="mt-12 flex flex-wrap gap-x-6 gap-y-9">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="w-[150px]">
              <div className="skeleton aspect-[640/900] w-full" />
              <div className="skeleton mt-3.5 h-4 w-3/4" />
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
