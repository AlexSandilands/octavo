import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "./ui";
import { Icon, type IconName } from "./icons";

const NAV: { key: string; label: string; href: string; icon: IconName }[] = [
  { key: "issues", label: "Issues", href: "/admin", icon: "grid" },
  { key: "members", label: "Members", href: "/admin/members", icon: "users" },
  { key: "sponsors", label: "Sponsors", href: "/admin/sponsors", icon: "banner" },
];

export function AdminShell({
  active,
  children,
}: {
  active: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-card flex min-h-screen">
      <aside className="bg-paper border-line flex w-[214px] flex-none flex-col border-r py-6">
        <div className="px-6">
          <Wordmark size={22} />
          <div className="text-accent mt-1 font-sans text-[10px] font-semibold tracking-[0.2em] uppercase">
            Admin
          </div>
        </div>
        <nav className="mt-7 flex flex-col">
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
        <Link
          href="/"
          className="text-muted hover:text-accent mt-auto flex items-center gap-2 px-6 py-2 font-sans text-[14px] font-medium"
        >
          <Icon name="chevronLeft" size={16} />
          View library
        </Link>
        <div className="border-line flex items-center gap-2.5 border-t px-6 pt-4">
          <span className="bg-accent text-paper flex h-[30px] w-[30px] items-center justify-center rounded-full font-sans text-xs font-semibold">
            AC
          </span>
          <div>
            <div className="text-ink font-sans text-[13px] font-semibold">
              A. Cole
            </div>
            <div className="text-faint font-sans text-[11px]">Editor</div>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-hidden p-7 sm:p-8">{children}</main>
    </div>
  );
}
