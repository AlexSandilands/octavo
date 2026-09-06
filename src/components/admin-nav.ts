import type { MastheadTab } from "./masthead";

// The admin's sections — the single source of the masthead's tab row.
export const ADMIN_NAV: MastheadTab[] = [
  { key: "issues", label: "Issues", href: "/admin" },
  { key: "members", label: "Members", href: "/admin/members" },
  { key: "sponsors", label: "Sponsors", href: "/admin/sponsors" },
  { key: "magazine", label: "Magazine", href: "/admin/magazine" },
  { key: "help", label: "Guide", href: "/admin/help" },
];
