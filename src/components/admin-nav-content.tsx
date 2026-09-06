import Link from "next/link";
import { initials } from "@/lib/initials";
import { signOutAction } from "@/app/signin/actions";
import { Avatar, Wordmark } from "./ui";
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

// The admin nav — wordmark, section nav, the way out to the library, sign out,
// who is signed in. One source of nav truth in two shapes: the desktop rail
// (icon over label, 80px wide) and the phone drawer's list (icon beside
// label). Kept a server component: it renders plain <Link>s; the drawer
// closes on link selection via click delegation on its own panel, so no
// per-link handler is threaded through here.
export function AdminNavContent({
  active,
  user,
  layout,
}: {
  active: string;
  user: { name?: string | null; email: string };
  layout: "rail" | "list";
}) {
  const rail = layout === "rail";
  const item = (on: boolean) =>
    rail
      ? `flex w-full flex-col items-center gap-1.5 border-l-[3px] py-3 font-ui text-[11px] font-medium transition-colors ${
          on
            ? "border-brass text-brass"
            : "text-chrome-muted hover:bg-lifted hover:text-chrome-text border-transparent"
        }`
      : `flex h-14 items-center gap-3.5 border-l-[3px] px-5 font-ui text-[17px] font-medium transition-colors ${
          on
            ? "border-brass bg-lifted text-brass"
            : "text-chrome-text hover:bg-lifted border-transparent"
        }`;
  return (
    <>
      <div
        className={
          rail
            ? "flex flex-col items-center pt-5 pb-3"
            : "flex items-baseline gap-2 px-6 pt-1"
        }
      >
        <Wordmark size={rail ? 17 : 22} tone="dark" />
        <div className="text-brass mt-1 font-meta text-[10px] font-medium tracking-[0.2em] uppercase">
          Admin
        </div>
      </div>
      <nav className={`flex flex-col ${rail ? "mt-2" : "mt-5"}`}>
        {ADMIN_NAV.map((n) => (
          <Link
            key={n.key}
            href={n.href}
            aria-current={n.key === active ? "page" : undefined}
            className={item(n.key === active)}
          >
            <Icon name={n.icon} size={rail ? 22 : 20} strokeWidth={1.6} />
            {n.label}
          </Link>
        ))}
        {/* Back-out link, not a section: it leaves the admin for the member-
            facing library. */}
        <Link href="/" className={`${item(false)} ${rail ? "mt-2" : "mt-3"}`}>
          <Icon name="book" size={rail ? 22 : 20} strokeWidth={1.6} />
          {rail ? "Library" : "View library"}
        </Link>
      </nav>
      <div
        className={`border-hairline mt-auto flex flex-col border-t ${
          rail ? "items-center gap-2 pt-3 pb-4" : "gap-3 px-6 pt-5 pb-2"
        }`}
      >
        <form action={signOutAction} className="w-full">
          <button type="submit" className={`${item(false)} cursor-pointer`}>
            <Icon name="logout" size={rail ? 22 : 20} strokeWidth={1.6} />
            Sign out
          </button>
        </form>
        <div
          className={`flex items-center gap-2.5 ${rail ? "" : "px-5"}`}
          title={user.name ?? user.email}
        >
          <Avatar
            tone="dark"
            size={rail ? 34 : 36}
            initials={initials(user.name?.trim() || user.email)}
          />
          {!rail && (
            <div className="text-chrome-text min-w-0 truncate font-ui text-[14px] font-medium">
              {user.name ?? user.email}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
