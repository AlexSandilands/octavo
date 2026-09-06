import type { ReactNode } from "react";
import { ADMIN_MAIN_ID } from "./admin-main";
import { ADMIN_NAV } from "./admin-nav";
import { Masthead } from "./masthead";

// The admin's frame: the slim masthead (dateline "Admin", the section tabs,
// a way back to the library) pinned over a scrolling content pane. h-screen +
// overflow-y-auto on <main>: only the pane scrolls, so the tabs stay in reach
// and the list pages can pin their own controls over their rows.
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
    <div className="bg-sheet flex h-screen flex-col">
      <Masthead
        size="slim"
        width="wide"
        dateline="Admin"
        user={user}
        tabs={ADMIN_NAV}
        active={active}
        trailing={{ key: "library", label: "← Back to library", href: "/" }}
      />
      {/* `relative` keeps absolute descendants (e.g. sr-only live regions) in
          this scroll pane; unanchored they stretch the document (#189). */}
      <main
        id={ADMIN_MAIN_ID}
        className="scrollbar-soft relative flex-1 overflow-y-auto [scrollbar-gutter:stable]"
      >
        <div className="mx-auto w-full max-w-6xl p-7 sm:p-8 md:h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
