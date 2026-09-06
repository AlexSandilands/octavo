import type { ReactNode } from "react";
import { ADMIN_MAIN_ID } from "./admin-main";
import { AdminNavContent } from "./admin-nav-content";
import { AdminDrawer } from "./admin-drawer";

export function AdminShell({
  active,
  user,
  children,
}: {
  active: string;
  user: { name?: string | null; email: string };
  children: ReactNode;
}) {
  return (
    // Top bar on desktop, mobile drawer below md.
    // main scrolls independently.
    <div className="bg-card flex h-screen flex-col">
      {/* Desktop broadsheet top bar (hidden on mobile) */}
      <header className="bg-paper border-line hidden flex-none border-b shadow-xs md:block">
        <AdminNavContent active={active} user={user} mobile={false} />
      </header>
      {/* Mobile top bar + off-canvas drawer */}
      <AdminDrawer>
        <AdminNavContent active={active} user={user} mobile={true} />
      </AdminDrawer>
      {/* `relative` keeps absolute descendants in this scroll pane */}
      <main
        id={ADMIN_MAIN_ID}
        className="scrollbar-soft relative flex-1 overflow-y-auto p-6 [--scrollbar-surface:var(--color-card)] [scrollbar-gutter:stable] sm:p-8"
      >
        <div className="mx-auto w-full max-w-6xl md:h-full md:flex md:flex-col">
          {children}
        </div>
      </main>
    </div>
  );
}
