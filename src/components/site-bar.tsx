import Link from "next/link";
import type { Session } from "next-auth";
import { DemoBadge } from "./demo-badge";
import { SignOutButton } from "./sign-out-button";
import { SiteMenu } from "./site-menu";
import { Avatar, Button, Icon, Wordmark } from "./ui";
import type { IconName } from "./icons";
import { initials } from "@/lib/initials";

// The dark bar every member-facing page opens with: the wordmark, the way to
// the archive and (for an admin) the admin area, and the account. Shared by `/`,
// `/archive` and the reader so the three can't drift. From `sm` the links sit
// in the bar; on a phone they fold into a full-screen menu behind one button.
export function SiteBar({
  user,
  home = false,
  archive = false,
}: {
  user: Session["user"] | null;
  /** The wordmark links back to the library (every page but the library). */
  home?: boolean;
  /** Offer the archive — only once the catalogue has outgrown the shelf. */
  archive?: boolean;
}) {
  const links: { href: string; label: string; icon: IconName }[] = [
    ...(home ? [{ href: "/", label: "Library", icon: "book" as const }] : []),
    ...(archive
      ? [{ href: "/archive", label: "Archive", icon: "grid" as const }]
      : []),
    // UX only — /admin is gated server-side regardless (issue #4).
    ...(user?.isAdmin
      ? [{ href: "/admin", label: "Admin", icon: "pencil" as const }]
      : []),
  ];

  return (
    <header className="border-hairline bg-raised border-b">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        {home ? (
          <Link
            href="/"
            className="rounded-ui flex h-11 items-center"
            aria-label="Back to the library"
          >
            <Wordmark size={24} tone="dark" />
          </Link>
        ) : (
          <Wordmark size={24} tone="dark" />
        )}

        {/* No user only happens in demo mode (the gate redirects otherwise):
            swap the account affordances for the demo chip. */}
        {user ? (
          <>
            <nav
              aria-label="Site"
              className="hidden items-center gap-1 sm:flex"
            >
              {links.map((l) => (
                <Button
                  key={l.href}
                  href={l.href}
                  variant="ghost"
                  tone="dark"
                  size="sm"
                >
                  {l.label}
                </Button>
              ))}
              <span className="bg-hairline mx-2 h-6 w-px" aria-hidden />
              <SignOutButton />
              <Avatar
                tone="dark"
                initials={initials(user.name?.trim() || user.email)}
              />
            </nav>
            <SiteMenu
              account={
                <div className="flex items-center gap-3">
                  <Avatar
                    tone="dark"
                    size={40}
                    initials={initials(user.name?.trim() || user.email)}
                  />
                  <div className="min-w-0">
                    <div className="text-chrome-text truncate font-ui text-[16px] font-medium">
                      {user.name ?? user.email}
                    </div>
                    {user.name && (
                      <div className="text-chrome-muted truncate font-ui text-[14px]">
                        {user.email}
                      </div>
                    )}
                  </div>
                </div>
              }
              signOut={<SignOutButton full />}
            >
              {[
                ...(home ? [] : [{ href: "/", label: "Library", icon: "book" }]),
                ...links,
                { href: "/preferences", label: "Email preferences", icon: "mail" },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="border-hairline text-chrome-text hover:bg-lifted rounded-ui flex h-14 items-center gap-3.5 border-b px-2 font-ui text-[18px] font-medium"
                >
                  <Icon name={l.icon as IconName} size={22} strokeWidth={1.6} />
                  {l.label}
                </Link>
              ))}
            </SiteMenu>
          </>
        ) : (
          <DemoBadge />
        )}
      </div>
    </header>
  );
}
