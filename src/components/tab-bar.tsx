import Link from "next/link";
import type { NavItem } from "./app-nav";
import { ADMIN_TABS, MEMBER_NAV } from "./app-nav";
import { MoreSheet } from "./more-sheet";
import { SignOutButton } from "./sign-out-button";
import { TAB_CLASS, TabInner } from "./tab-inner";

// One tab: icon over label, the icon on a tinted pill when it is the page.
// The whole 56px-tall cell is the target.
function TabLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={TAB_CLASS}
    >
      <TabInner icon={item.icon} label={item.label} active={active} />
    </Link>
  );
}

// The phone tab bar (below md): a strip at the foot of the shell, safe-area
// aware. Members get Library / Archive / Account; inside the admin it
// switches to Issues / Members / Sponsors / More.
export function TabBar({
  area,
  active,
  signedIn,
}: {
  area: "member" | "admin";
  active: string | null;
  signedIn: boolean;
}) {
  const tabs = area === "member" ? MEMBER_NAV : ADMIN_TABS;
  return (
    <nav
      aria-label="Main"
      className="bg-surface border-hairline flex h-tabbar flex-none items-stretch gap-1 border-t px-1 pt-1 pb-[env(safe-area-inset-bottom,0px)] md:hidden"
    >
      {tabs.map((item) => (
        <TabLink key={item.key} item={item} active={item.key === active} />
      ))}
      {area === "admin" && (
        <MoreSheet
          active={active}
          signOut={signedIn ? <SignOutButton variant="row" /> : null}
        />
      )}
    </nav>
  );
}
