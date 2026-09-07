import Link from "next/link";
import { initials } from "@/lib/initials";
import { ADMIN_NAV, MEMBER_NAV, type NavItem, type ShellUser } from "./app-nav";
import { DemoBadge } from "./demo-badge";
import { Icon } from "./icons";
import { SignOutButton } from "./sign-out-button";
import { Avatar, Wordmark } from "./ui";

// One row of the sidebar: icon + label, a rounded tint when it is the page.
export function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex h-12 items-center gap-3 rounded-field px-3 font-ui text-[17px] font-bold transition-colors ${
        active
          ? "bg-primary-soft text-primary"
          : "text-fg-muted hover:bg-primary-wash hover:text-primary"
      }`}
    >
      <Icon name={item.icon} size={22} strokeWidth={1.9} />
      {item.label}
    </Link>
  );
}

function NavGroup({
  label,
  items,
  active,
}: {
  label?: string;
  items: NavItem[];
  active: string | null;
}) {
  return (
    <div>
      {label && (
        <div className="text-fg-muted mb-1 px-3 font-ui text-[13px] font-bold tracking-[0.12em] uppercase">
          {label}
        </div>
      )}
      <div className="flex flex-col gap-0.5">
        {items.map((item) => (
          <NavRow key={item.key} item={item} active={item.key === active} />
        ))}
      </div>
    </div>
  );
}

// The desktop sidebar (md+): wordmark, the area's rows, the user card and
// Sign out. Members see Library / Archive / Account, admins also an Admin
// section; inside the admin the list is the admin's own plus a way back.
export function SidebarNav({
  area,
  active,
  user,
  loading = false,
}: {
  area: "member" | "admin";
  active: string | null;
  user: ShellUser | null;
  loading?: boolean;
}) {
  return (
    <aside className="bg-surface border-hairline hidden w-[240px] flex-none flex-col border-r md:flex">
      <div className="px-5 pt-6 pb-4">
        <Link
          href="/"
          aria-label="Back to the library"
          className="inline-flex h-11 items-center rounded-full"
        >
          <Wordmark size={20} />
        </Link>
      </div>
      <nav
        aria-label="Main"
        className="scrollbar-soft flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-3 pb-3 [--scrollbar-surface:var(--color-surface)]"
      >
        {area === "member" ? (
          <>
            <NavGroup items={MEMBER_NAV} active={active} />
            {user?.isAdmin && (
              <NavGroup label="Admin" items={ADMIN_NAV} active={active} />
            )}
          </>
        ) : (
          <>
            <NavGroup label="Admin" items={ADMIN_NAV} active={active} />
            <NavGroup
              items={[
                {
                  key: "library",
                  label: "Back to library",
                  href: "/",
                  icon: "arrowLeft",
                },
              ]}
              active={active}
            />
          </>
        )}
        <div className="border-hairline mt-auto border-t px-0 pt-4 pb-1">
          {user ? (
            <>
              <div className="flex items-center gap-3 px-2 pb-3">
                <Avatar
                  initials={initials(user.name?.trim() || user.email)}
                  size={40}
                />
                <div className="min-w-0">
                  <div className="text-fg truncate font-ui text-[16px] font-bold">
                    {user.name?.trim() || user.email}
                  </div>
                  {user.name?.trim() && (
                    <div className="text-fg-muted truncate font-ui text-[13px]">
                      {user.email}
                    </div>
                  )}
                </div>
              </div>
              <SignOutButton variant="row" />
            </>
          ) : loading ? (
            <div aria-hidden className="flex items-center gap-3 px-2 pb-3">
              <span className="skeleton h-10 w-10 flex-none rounded-full" />
              <div className="min-w-0 flex-1">
                <div className="skeleton h-4 w-24" />
                <div className="skeleton mt-2 h-3 w-32" />
              </div>
            </div>
          ) : (
            <div className="px-2">
              <DemoBadge />
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
}
