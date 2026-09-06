import Link from "next/link";
import type { Session } from "next-auth";
import { DemoBadge } from "@/components/demo-badge";
import { SignOutButton } from "@/components/sign-out-button";
import { Wordmark, Avatar } from "@/components/ui";
import { initials } from "@/lib/initials";

export function LibraryHeader({
  user,
  home = false,
}: {
  user: Session["user"] | null;
  home?: boolean;
}) {
  return (
    <header className="folio-library-header">
      <Link
        href="/"
        aria-label="Back to the library"
        className="folio-home-mark"
      >
        <Wordmark size={26} />
      </Link>
      <nav aria-label="Member navigation" className="folio-member-nav">
        <Link href="/" aria-current={!home ? "page" : undefined}>
          Reading room
        </Link>
        <Link href="/archive">All issues</Link>
        {user && <Link href="/preferences">Email preferences</Link>}
      </nav>
      <div className="folio-account">
        {user ? (
          <>
            {user.isAdmin && <Link href="/admin">Publishing desk</Link>}
            <SignOutButton />
            <Avatar initials={initials(user.name?.trim() || user.email)} />
          </>
        ) : (
          <DemoBadge />
        )}
      </div>
    </header>
  );
}
