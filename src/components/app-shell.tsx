import Link from "next/link";
import type { ReactNode } from "react";
import { ADMIN_MAIN_ID } from "./admin-main";
import { ADMIN_NAV, MEMBER_NAV, type ShellUser } from "./app-nav";
import { DemoBadge } from "./demo-badge";
import { SidebarNav } from "./sidebar-nav";
import { TabBar } from "./tab-bar";
import { Chip, Wordmark } from "./ui";

// The one shell for members and admins (Compass). From md up a left sidebar
// with the area's rows and the user card; below md a slim top bar (wordmark +
// page title) and a bottom tab bar. The content pane, not the window, scrolls
// at every width — the admin lists pin their controls against it and the
// pagination resets it — so the bars never move.
export function AppShell({
  area,
  active,
  user,
  loading = false,
  title,
  children,
}: {
  area: "member" | "admin";
  /** The key of the current nav item, or null (a loading skeleton). */
  active: string | null;
  /** Null only in demo mode and in loading skeletons. */
  user: ShellUser | null;
  /** A loading skeleton: who is signed in isn't known yet, so the user card
   * is a placeholder and the Demo badge stays off. */
  loading?: boolean;
  /** The phone top bar's title; defaults to the active item's label. */
  title?: string;
  children: ReactNode;
}) {
  const items = area === "member" ? MEMBER_NAV : ADMIN_NAV;
  const heading = title ?? items.find((i) => i.key === active)?.label ?? "";
  return (
    <div className="bg-ground flex h-dvh">
      <SidebarNav area={area} active={active} user={user} loading={loading} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="bg-surface border-hairline flex h-14 flex-none items-center justify-between gap-3 border-b px-4 md:hidden">
          <Link
            href="/"
            aria-label="Back to the library"
            className="inline-flex h-11 items-center rounded-full"
          >
            <Wordmark size={17} />
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            {area === "admin" && <Chip tone="primary">Admin</Chip>}
            {heading && (
              <span className="text-fg-muted truncate font-ui text-[15px] font-bold">
                {heading}
              </span>
            )}
            {!user && !loading && <DemoBadge />}
          </div>
        </header>
        {/* `relative` keeps absolute descendants (sr-only live regions) in
            this scroll pane; unanchored they stretch the document (#189). */}
        <main
          id={ADMIN_MAIN_ID}
          className="scrollbar-soft relative min-h-0 flex-1 overflow-y-auto p-5 [--scrollbar-surface:var(--color-ground)] [scrollbar-gutter:stable] sm:p-8"
        >
          {children}
        </main>
        <TabBar area={area} active={active} signedIn={Boolean(user)} />
      </div>
    </div>
  );
}
