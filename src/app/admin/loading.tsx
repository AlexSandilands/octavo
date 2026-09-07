import { AppShell } from "@/components/app-shell";

// Admin skeleton: the page header, the stats strip and a list card of rows.
// Covers /admin and its child routes (members, sponsors, editor) while their
// data loads.
export default function AdminLoading() {
  return (
    <AppShell area="admin" active={null} user={null} loading>
      <div role="status" aria-label="Loading">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="skeleton h-9 w-40" />
            <div className="skeleton mt-3 h-5 w-56" />
          </div>
          <div className="skeleton h-12 w-44 rounded-full" />
        </div>
        <div className="mt-4 flex gap-3">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="skeleton h-[72px] w-40 rounded-card" />
          ))}
        </div>
        <div className="skeleton mt-6 h-12 w-full rounded-full" />
        <div className="bg-surface border-hairline divide-hairline mt-6 divide-y rounded-card border">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-5 px-4 py-3">
              <div className="skeleton h-6 w-6 rounded-[7px]" />
              <div className="skeleton h-[60px] w-[46px] flex-none rounded-[4px]" />
              <div className="min-w-0 flex-1">
                <div className="skeleton h-5 w-1/3" />
                <div className="skeleton mt-2 h-4 w-20" />
              </div>
              <div className="skeleton h-8 w-24 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
