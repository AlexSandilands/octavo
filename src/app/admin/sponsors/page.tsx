import { AdminShell } from "@/components/admin-shell";
import { Icon } from "@/components/icons";

// Placeholder — the layout anticipates sponsor management (see docs/SPEC.md §8).
export default function SponsorsPage() {
  return (
    <AdminShell active="sponsors">
      <div className="bg-card border-line max-w-3xl rounded-md border p-7 shadow-[0_1px_3px_rgba(0,0,0,0.07)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-ink font-serif text-2xl">Sponsors</h1>
            <span className="bg-warn-soft text-warn rounded-full px-3 py-1 font-sans text-[11px] font-semibold">
              Planned
            </span>
          </div>
          <div className="text-faint2 flex h-10 items-center gap-2 rounded-lg border-[1.5px] border-dashed border-[#cfc6b4] px-4 font-sans text-sm font-semibold">
            <Icon name="plus" size={15} strokeWidth={1.8} />
            Add sponsor
          </div>
        </div>
        <p className="text-faint mt-2 max-w-md font-sans text-sm leading-relaxed">
          When advertising goes live, sponsors will be managed here — logo,
          link, and the dates each is active. Sponsor blocks already render in
          the magazine theme.
        </p>

        <div className="mt-6 opacity-60">
          <div className="border-line text-faint2 flex items-center border-b px-1 pb-2.5 font-sans text-[10px] font-semibold tracking-[0.14em] uppercase">
            <span className="flex-1">Sponsor</span>
            <span className="w-[150px]">Link</span>
            <span className="w-[120px]">Active dates</span>
          </div>
          {[0, 1].map((r) => (
            <div
              key={r}
              className="border-line-soft flex items-center border-b px-1 py-3.5"
            >
              <div className="flex flex-1 items-center gap-3">
                <div className="h-8 w-[54px] rounded bg-[#ece6da]" />
                <div className="h-2.5 w-28 rounded bg-[#ece6da]" />
              </div>
              <div className="h-2.5 w-[150px] rounded bg-[#ece6da]" />
              <div className="h-2.5 w-[120px] rounded bg-[#ece6da]" />
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
