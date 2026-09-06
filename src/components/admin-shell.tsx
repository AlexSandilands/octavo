import type { ReactNode } from "react";
import Link from "next/link";
import { ADMIN_MAIN_ID } from "./admin-main";
import { ADMIN_NAV, AdminNavContent } from "./admin-nav-content";
import { AdminDrawer } from "./admin-drawer";
import { Wordmark, Avatar } from "./ui";
import { SignOutButton } from "./sign-out-button";
import { Icon } from "./icons";
import { initials } from "@/lib/initials";

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
    <div className="harbour-admin flex h-dvh flex-col">
      <header className="harbour-admin-top hidden md:block">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <Wordmark size={27} />
            <span className="border-l border-white/30 pl-5 text-sm text-[#d7e8e3]">
              Club workspace
            </span>
          </div>
          <div className="flex items-center gap-5 text-sm">
            <Link
              className="flex min-h-11 items-center gap-2 font-semibold hover:underline"
              href="/"
            >
              <Icon name="arrowRight" size={17} />
              View library
            </Link>
            <span className="hidden lg:inline">{user.name ?? user.email}</span>
            <Avatar initials={initials(user.name?.trim() || user.email)} />
            <span className="rounded-full bg-white px-3">
              <SignOutButton />
            </span>
          </div>
        </div>
        <nav aria-label="Administration" className="harbour-admin-nav">
          {ADMIN_NAV.map((n) => (
            <Link
              key={n.key}
              href={n.href}
              aria-current={n.key === active ? "page" : undefined}
            >
              <Icon name={n.icon} size={18} />
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <AdminDrawer>
        <AdminNavContent active={active} user={user} />
      </AdminDrawer>
      <main
        id={ADMIN_MAIN_ID}
        className="harbour-admin-main scrollbar-soft relative flex-1 overflow-y-auto p-7 [--scrollbar-surface:var(--color-card)] [scrollbar-gutter:stable] sm:p-8"
      >
        {children}
      </main>
    </div>
  );
}
