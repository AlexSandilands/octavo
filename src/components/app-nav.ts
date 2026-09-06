import type { IconName } from "./icons";

// Who the shell is drawn for — the user card and the admin rows key off it.
export type ShellUser = {
  name?: string | null;
  email: string;
  isAdmin?: boolean;
};

// The app's two navigation lists — one source of truth for the sidebar, the
// phone tab bar and the "More" sheet. `key` is what a page passes as `active`.
export type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: IconName;
};

export const MEMBER_NAV: NavItem[] = [
  { key: "library", label: "Library", href: "/", icon: "library" },
  { key: "archive", label: "Archive", href: "/archive", icon: "archive" },
  { key: "account", label: "Account", href: "/preferences", icon: "user" },
];

export const ADMIN_NAV: NavItem[] = [
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
    icon: "sliders",
  },
  { key: "help", label: "Guide", href: "/admin/help", icon: "help" },
];

// The phone tab bar shows at most four tabs; the rest of the admin list lives
// in the "More" sheet.
export const ADMIN_TABS = ADMIN_NAV.slice(0, 3);
export const ADMIN_MORE = ADMIN_NAV.slice(3);
