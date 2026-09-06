import type { ReactNode } from "react";
import { ADMIN_MAIN_ID } from "./admin-main";
import { AdminNavContent } from "./admin-nav-content";
import { AdminDrawer } from "./admin-drawer";

// The admin frame: a narrow dark rail down the left (icon over label, the
// current section marked in brass) and the page as a paper sheet lit on the
// ground beside it. Below md the rail becomes a top bar with a drawer.
export function AdminShell({
  active,
  user,
  fit = false,
  children,
}: {
  active: string;
  user: { name?: string | null; email: string };
  /** A list page: the sheet is held to the pane's height so the page can pin
   *  its controls and scroll only its rows (admin-list-layout.ts). Off, the
   *  sheet grows with the page and the pane scrolls. */
  fit?: boolean;
  children: ReactNode;
}) {
  return (
    // Column on mobile (top bar over content), row on desktop (rail beside it).
    // h-screen + overflow-y-auto on <main>: only the content pane scrolls, so
    // the rail (and its foot) stays pinned to the viewport.
    <div className="bg-ground flex h-screen flex-col md:flex-row">
      {/* Desktop rail — hidden below md, where the drawer takes over. */}
      <aside className="border-hairline hidden w-20 flex-none flex-col border-r md:flex">
        <AdminNavContent active={active} user={user} layout="rail" />
      </aside>
      {/* Mobile top bar + off-canvas drawer (client island for open/close). */}
      <AdminDrawer>
        <AdminNavContent active={active} user={user} layout="list" />
      </AdminDrawer>
      {/* `relative` keeps absolute descendants (e.g. sr-only live regions) in
          this scroll pane; unanchored they stretch the document (#189). The
          sheet inside carries the padding a page lays itself out against —
          edge to edge on a phone, floating on the ground from md. */}
      <main
        id={ADMIN_MAIN_ID}
        className="scrollbar-soft scrollbar-dark relative flex-1 overflow-y-auto [scrollbar-gutter:stable] md:flex md:flex-col md:p-5 lg:p-7"
      >
        <div
          className={`on-paper bg-paper text-ink p-7 sm:p-8 md:rounded-sheet md:shadow-sheet ${
            fit ? "md:flex md:min-h-0 md:flex-1 md:flex-col" : "md:min-h-full"
          }`}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
