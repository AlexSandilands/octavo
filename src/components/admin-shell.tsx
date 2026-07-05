import type { ReactNode } from "react";
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
    // Column on mobile (top bar over content), row on desktop (rail beside it).
    // h-screen + overflow-y-auto on <main>: only the content pane scrolls, so
    // the sidebar (and its mt-auto footer) stays pinned to the viewport.
    <div className="bg-card flex h-screen flex-col md:flex-row">
      {/* Desktop rail — hidden below md, where the drawer takes over. Unchanged
          from the original fixed 214px sidebar at md+. */}
      <aside className="bg-paper border-line hidden w-[214px] flex-none flex-col border-r py-6 md:flex">
        <AdminNavContent active={active} user={user} />
      </aside>
      {/* Mobile top bar + off-canvas drawer (client island for open/close). */}
      <AdminDrawer>
        <AdminNavContent active={active} user={user} />
      </AdminDrawer>
      <main id="admin-main" className="flex-1 overflow-y-auto p-7 sm:p-8">
        {children}
      </main>
    </div>
  );
}
