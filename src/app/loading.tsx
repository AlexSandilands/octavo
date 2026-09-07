import { AppShell } from "@/components/app-shell";

// Library skeleton: the greeting, the latest-issue card and a row of issue
// cards, so a slow database shows the page taking shape instead of a blank.
export default function LibraryLoading() {
  return (
    <AppShell area="member" active={null} user={null} loading>
      <div
        role="status"
        aria-label="Loading the library"
        className="mx-auto flex max-w-4xl flex-col gap-6"
      >
        <div className="bg-surface border-hairline rounded-card border p-5 sm:p-7">
          <div className="skeleton h-8 w-28" />
          <div className="skeleton mt-4 h-9 w-2/3" />
          <div className="skeleton mt-3 h-5 w-1/2" />
        </div>
        <div className="bg-surface border-hairline grid gap-6 rounded-card border p-5 sm:grid-cols-[200px_1fr] sm:p-7">
          <div className="skeleton aspect-[640/900] w-[200px] justify-self-center sm:justify-self-start" />
          <div>
            <div className="skeleton h-5 w-24" />
            <div className="skeleton mt-4 h-9 w-3/4" />
            <div className="skeleton mt-3 h-5 w-1/2" />
            <div className="mt-5 flex gap-2">
              <div className="skeleton h-8 w-24 rounded-full" />
              <div className="skeleton h-8 w-32 rounded-full" />
            </div>
            <div className="skeleton mt-8 h-14 w-44 rounded-full" />
          </div>
        </div>
        <div className="flex flex-wrap gap-3 sm:gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="bg-surface border-hairline w-[164px] rounded-card border p-2.5"
            >
              <div className="skeleton aspect-[640/900] w-full rounded-[8px]" />
              <div className="skeleton mt-3 h-5 w-3/4" />
              <div className="skeleton mt-3 h-10 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
