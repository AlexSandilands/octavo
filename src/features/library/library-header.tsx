import Link from "next/link";
import type { Session } from "next-auth";
import { DemoBadge } from "@/components/demo-badge";
import { SignOutButton } from "@/components/sign-out-button";
import { Wordmark, Avatar } from "@/components/ui";
import { initials } from "@/lib/initials";

// The chrome every member-facing library page opens with — the wordmark and
// the account affordances. Shared by `/` and `/archive` so the two can't drift.
// `home` links the wordmark back to the library from the pages that aren't it.
export function LibraryHeader({
  user,
  home = false,
}: {
  user: Session["user"] | null;
  home?: boolean;
}) {
  return (
    <header className="border-line flex items-center justify-between gap-3 border-b pb-4">
      {home ? (
        <Link
          href="/"
          className="hover:text-accent flex h-11 items-center"
          aria-label="Back to the library"
        >
          <Wordmark size={24} />
        </Link>
      ) : (
        <Wordmark size={24} />
      )}
      <nav className="flex flex-none items-center gap-3 font-sans text-sm sm:gap-4">
        {/* No user only happens in demo mode (the gate redirects otherwise):
            swap the account affordances for the demo chip. */}
        {user ? (
          <>
            {/* UX only — /admin is gated server-side regardless (issue #4). */}
            {user.isAdmin && (
              <Link
                href="/admin"
                className="border-hair text-ink hover:border-accent hover:text-accent rounded-lg border px-3 py-1.5 font-medium"
              >
                Admin
              </Link>
            )}
            <SignOutButton />
            <Avatar initials={initials(user.name?.trim() || user.email)} />
          </>
        ) : (
          <DemoBadge />
        )}
      </nav>
    </header>
  );
}
