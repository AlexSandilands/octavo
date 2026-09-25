"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";

const ADMIN_NAV: {
  key: string;
  label: string;
  href: string;
  icon: IconName;
  /** Shown only while the server offers the assistant (#314). */
  assistant?: boolean;
}[] = [
  { key: "issues", label: "Issues", href: "/admin", icon: "grid" },
  { key: "members", label: "Members", href: "/admin/members", icon: "users" },
  {
    key: "sponsors",
    label: "Sponsors",
    href: "/admin/sponsors",
    icon: "banner",
  },
  { key: "reports", label: "Reports", href: "/admin/reports", icon: "flag" },
  {
    key: "magazine",
    label: "Magazine",
    href: "/admin/magazine",
    icon: "image",
  },
  {
    key: "assistant",
    label: "Assistant",
    href: "/admin/ai",
    icon: "sparkle",
    assistant: true,
  },
  { key: "help", label: "Guide", href: "/admin/help", icon: "help" },
];

// `openReports` badges the Reports entry (issue #302); it comes from the
// dashboard layout, which every row action revalidates. `assistant` is the
// server's isAssistantEnabled().
export function AdminNavLinks({
  openReports = 0,
  assistant = false,
}: {
  openReports?: number;
  assistant?: boolean;
}) {
  const pathname = usePathname();
  const links = assistant ? ADMIN_NAV : ADMIN_NAV.filter((n) => !n.assistant);
  return (
    <nav className="mt-5 flex flex-col">
      {links.map((n) => {
        const on =
          pathname === n.href ||
          (n.href !== "/admin" && pathname.startsWith(`${n.href}/`));
        return (
          <Link
            key={n.key}
            href={n.href}
            aria-current={on ? "page" : undefined}
            className={`flex items-center gap-3 border-l-2 px-6 py-2.5 font-sans text-[15px] transition-colors ${
              on
                ? "bg-tint text-accent border-accent font-semibold"
                : "text-muted hover:bg-tint/60 hover:text-accent border-transparent font-medium"
            }`}
          >
            <Icon name={n.icon} size={18} />
            {n.label}
            {n.key === "reports" && openReports > 0 && (
              <span className="bg-warn text-paper ml-auto rounded-full px-2 py-0.5 font-sans text-[12px] font-semibold tabular-nums">
                {openReports}
                <span className="sr-only"> open</span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
