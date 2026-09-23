import Link from "next/link";
import { initials } from "@/lib/initials";
import { SignOutButton } from "./sign-out-button";
import { Wordmark } from "./ui";
import { Icon } from "./icons";
import { AdminNavLinks } from "./admin-nav-links";

export type AdminNavUser = {
  name?: string | null;
  email: string;
  /** The default posting name and its photo while discussion is on (#300). */
  avatarName?: string | null;
  avatarUrl?: string | null;
};

// Shared by the desktop rail and mobile drawer; only the links track the route.
export function AdminNavContent({ user }: { user: AdminNavUser }) {
  return (
    <>
      <div className="px-6">
        <Wordmark size={22} />
        <div className="text-accent mt-1 font-sans text-[10px] font-semibold tracking-[0.2em] uppercase">
          Admin
        </div>
      </div>
      {/* Back-out link, not a section: it leaves the admin for the member-
          facing library, so it sits above the nav rather than in it. */}
      <Link
        href="/"
        className="text-muted hover:text-accent mt-5 flex items-center gap-2 px-6 py-1.5 font-sans text-[14px] font-medium hover:underline"
      >
        <Icon name="chevronLeft" size={16} />
        View library
      </Link>
      <AdminNavLinks />
      <div className="border-line mt-auto border-t px-6 pt-4">
        <Link
          href="/profile"
          aria-label="Your profile"
          className="hover:bg-accent-wash -mx-2 flex min-h-11 items-center gap-2.5 rounded-lg px-2 transition-colors"
        >
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- a 256px WebP in a fixed box
            <img
              src={user.avatarUrl}
              alt=""
              className="bg-tint h-[30px] w-[30px] flex-none rounded-full object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="bg-accent text-paper flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full font-sans text-xs font-semibold"
            >
              {initials(user.avatarName ?? (user.name?.trim() || user.email))}
            </span>
          )}
          <span className="text-ink min-w-0 truncate font-sans text-[13px] font-semibold">
            {user.name ?? user.email}
          </span>
        </Link>
        <SignOutButton variant="sidebar" />
      </div>
    </>
  );
}
