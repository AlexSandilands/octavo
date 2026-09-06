import { AppShell } from "@/components/app-shell";

// Archive skeleton: title, the search card and a shelf of cards. Its own file
// because the root skeleton leads with a hero this page never has.
export default function ArchiveLoading() {
  return (
    <AppShell area="member" active="archive" user={null}>
      <div
        role="status"
        aria-label="Loading the archive"
        className="mx-auto max-w-4xl"
      >
        <div className="skeleton h-9 w-56" />
        <div className="skeleton mt-3 h-5 w-72" />
        <div className="bg-surface border-hairline mt-5 flex flex-col gap-3 rounded-card border p-3 sm:p-4">
          <div className="skeleton h-12 w-full rounded-full" />
          <div className="flex gap-2">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="skeleton h-11 w-24 rounded-full" />
            ))}
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3 sm:gap-4">
          {Array.from({ length: 8 }, (_, i) => (
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
