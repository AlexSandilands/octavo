"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";
import { adminMain } from "./admin-main";

const ADMIN_NAV: {
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

export function AdminNavLinks() {
  const pathname = usePathname();
  return (
    <nav className="mt-5 flex flex-col">
      {ADMIN_NAV.map((n) => {
        const on =
          pathname === n.href ||
          (n.href !== "/admin" && pathname.startsWith(`${n.href}/`));
        return (
          <Link
            key={n.key}
            href={n.href}
            onNavigate={() => adminMain()?.scrollTo({ top: 0 })}
            aria-current={on ? "page" : undefined}
            className={`flex items-center gap-3 border-l-2 px-6 py-2.5 font-sans text-[15px] transition-colors ${
              on
                ? "bg-tint text-accent border-accent font-semibold"
                : "text-muted hover:bg-tint/60 hover:text-accent border-transparent font-medium"
            }`}
          >
            <Icon name={n.icon} size={18} />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
