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
      <div className="px-6">
        <Wordmark size={22} className="text-[#fcf9f2]" />
        <div className="text-[#c49348] mt-1 font-sans text-[10px] font-bold tracking-[0.22em] uppercase">
          Steward&apos;s Office
        </div>
      </div>
      {/* Back-out link, not a section: it leaves the admin for the member-
          facing library, so it sits above the nav rather than in it. */}
      <Link
        href="/"
        className="text-[#a4b8af] hover:text-[#e8c374] mt-5 flex items-center gap-2 px-6 py-1.5 font-sans text-[13px] font-medium transition-colors"
      >
        <Icon name="chevronLeft" size={16} />
        Return to Reading Room
      </Link>
      <nav className="mt-5 flex flex-col">
        {ADMIN_NAV.map((n) => {
          const on = n.key === active;
          return (
            <Link
              key={n.key}
              href={n.href}
              className={`flex items-center gap-3 border-l-3 px-6 py-2.5 font-sans text-[14px] transition-colors ${
                on
                  ? "bg-white/10 text-[#e8c374] border-[#c49348] font-bold"
                  : "text-[#a4b8af] hover:bg-white/5 hover:text-[#fcf9f2] border-transparent font-medium"
              }`}
            >
              <Icon name={n.icon} size={18} />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-[#1d3f32] mt-auto border-t px-6 pt-4">
        <div className="flex items-center gap-2.5">
          <span className="bg-[#c49348] text-[#10241c] flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[4px] font-serif text-xs font-bold shadow-xs">
            {initials(user.name?.trim() || user.email)}
          </span>
          <div className="text-[#fcf9f2] min-w-0 truncate font-sans text-[13px] font-semibold">
            {user.name ?? user.email}
          </div>
        </div>
        <SignOutButton
          variant="sidebar"
          className="text-[#a4b8af] hover:text-[#e8c374]"
        />
      </div>
    </>
  );
}
