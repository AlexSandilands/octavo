import Link from "next/link";
import { initials } from "@/lib/initials";
import { SignOutButton } from "./sign-out-button";
import { Wordmark } from "./ui";
import { Icon, type IconName } from "./icons";

export const ADMIN_NAV: {
  key: string;
  label: string;
  href: string;
  icon: IconName;
}[] = [
  { key: "issues", label: "Issues", href: "/admin", icon: "grid" },
  { key: "members", label: "Members", href: "/admin/members", icon: "users" },
  {
    key: "sponsors",
    label: "Sponsors",
    href: "/admin/sponsors",
    icon: "banner",
  },
  {
    key: "magazine",
    label: "Magazine",
    href: "/admin/magazine",
    icon: "image",
  },
  { key: "help", label: "Guide", href: "/admin/help", icon: "help" },
];

// The admin nav column — wordmark, back-out link, section nav, user footer.
// Shared verbatim by the desktop rail (AdminShell) and the mobile drawer
// (AdminDrawer) so there's one source of nav truth. Kept a server component:
// it renders plain <Link>s; the drawer closes on link selection via click
// delegation on its own panel, so no per-link handler is threaded through here.
export function AdminNavContent({
  active,
  user,
}: {
  active: string;
  user: { name?: string | null; email: string };
}) {
  return (
    <>
      <div className="px-5">
        <Wordmark size={20} />
        <div className="text-accent mt-1.5 font-sans text-[10px] font-bold tracking-[0.2em] uppercase">
          Studio Workspace
        </div>
      </div>
      {/* Back-out link, not a section: it leaves the admin for the member-
          facing library, so it sits above the nav rather than in it. */}
      <Link
        href="/"
        className="text-muted hover:text-accent hover:bg-slate-100 mx-3 mt-4 flex items-center gap-2 rounded-xl px-3 py-2 font-sans text-[13px] font-medium transition-colors"
      >
        <Icon name="chevronLeft" size={15} />
        View library
      </Link>
      <nav className="mt-4 flex flex-col gap-1 px-3">
        {ADMIN_NAV.map((n) => {
          const on = n.key === active;
          return (
            <Link
              key={n.key}
              href={n.href}
              className={`flex items-center gap-3 rounded-xl px-4 py-2.5 font-sans text-[14px] transition-all duration-150 ${
                on
                  ? "bg-accent text-white font-semibold shadow-xs"
                  : "text-muted hover:bg-slate-100 hover:text-ink font-medium"
              }`}
            >
              <Icon name={n.icon} size={17} />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-line/80 mx-3 mt-auto border-t pt-4">
        <div className="bg-slate-50 border border-line rounded-xl p-2.5 flex flex-col gap-2">
          <div className="flex items-center gap-2.5">
            <span className="bg-accent text-white flex h-[28px] w-[28px] flex-none items-center justify-center rounded-lg font-sans text-xs font-bold shadow-xs">
              {initials(user.name?.trim() || user.email)}
            </span>
            <div className="text-ink min-w-0 truncate font-sans text-[12px] font-semibold">
              {user.name ?? user.email}
            </div>
          </div>
          <SignOutButton variant="sidebar" />
        </div>
      </div>
    </>
  );
}
