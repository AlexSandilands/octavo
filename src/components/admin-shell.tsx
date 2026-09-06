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
    // Column on mobile (top bar over content), row on desktop (rail beside it).
    // h-screen + overflow-y-auto on <main>: only the content pane scrolls, so
    // the sidebar (and its mt-auto footer) stays pinned to the viewport.
    <div className="bg-card flex h-screen flex-col md:flex-row">
      {/* Desktop rail — modern white studio dock */}
      <aside className="bg-white border-line hidden w-[230px] flex-none flex-col border-r py-6 md:flex shadow-xs">
        <AdminNavContent active={active} user={user} />
      </aside>
      {/* Mobile top bar + off-canvas drawer (client island for open/close). */}
      <AdminDrawer>
        <AdminNavContent active={active} user={user} />
      </AdminDrawer>
      {/* `relative` keeps absolute descendants (e.g. sr-only live regions) in
          this scroll pane; unanchored they stretch the document (#189). */}
      <main
        id={ADMIN_MAIN_ID}
        className="scrollbar-soft relative flex-1 overflow-y-auto p-7 [--scrollbar-surface:var(--color-card)] [scrollbar-gutter:stable] sm:p-8"
      >
        {children}
      </main>
    </div>
  );
}
