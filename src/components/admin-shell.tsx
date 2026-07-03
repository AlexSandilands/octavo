import Link from "next/link";
import type { ReactNode } from "react";
import { signOutAction } from "@/app/signin/actions";
import { Wordmark } from "./ui";
import { Icon, type IconName } from "./icons";

const NAV: { key: string; label: string; href: string; icon: IconName }[] = [
  { key: "issues", label: "Issues", href: "/admin", icon: "grid" },
  { key: "members", label: "Members", href: "/admin/members", icon: "users" },
  {
    key: "sponsors",
    label: "Sponsors",
    href: "/admin/sponsors",
    icon: "banner",
  },
];

function initials(name: string | null | undefined, email: string) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return email[0]?.toUpperCase() ?? "?";
}

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
    // h-screen + overflow-y-auto on <main>: only the content pane scrolls, so
    // the sidebar (and its mt-auto footer) stays pinned to the viewport.
    <div className="bg-card flex h-screen">
      <aside className="bg-paper border-line flex w-[214px] flex-none flex-col border-r py-6">
        <div className="px-6">
          <Wordmark size={22} />
          <div className="text-accent mt-1 font-sans text-[10px] font-semibold tracking-[0.2em] uppercase">
            Admin
          </div>
        </div>
        {/* Back-out link, not a section: it leaves the admin for the member-
            facing library, so it sits above the nav rather than in it. */}
        <Link
          href="/"
          className="text-muted hover:text-accent mt-5 flex items-center gap-2 px-6 py-1.5 font-sans text-[14px] font-medium"
        >
          <Icon name="chevronLeft" size={16} />
          View library
        </Link>
        <nav className="mt-5 flex flex-col">
          {NAV.map((n) => {
            const on = n.key === active;
            return (
              <Link
                key={n.key}
                href={n.href}
                className={`flex items-center gap-3 border-l-2 px-6 py-2.5 font-sans text-[15px] ${
                  on
                    ? "bg-tint text-accent border-accent font-semibold"
                    : "text-muted border-transparent font-medium"
                }`}
              >
                <Icon name={n.icon} size={18} />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-line mt-auto flex items-center gap-2.5 border-t px-6 pt-4">
          <span className="bg-accent text-paper flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full font-sans text-xs font-semibold">
            {initials(user.name, user.email)}
          </span>
          <div className="min-w-0">
            <div className="text-ink truncate font-sans text-[13px] font-semibold">
              {user.name ?? user.email}
            </div>
            <form action={signOutAction}>
              <button
                type="submit"
                className="text-faint hover:text-accent font-sans text-[11px] underline underline-offset-2"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-7 sm:p-8">{children}</main>
    </div>
  );
}
