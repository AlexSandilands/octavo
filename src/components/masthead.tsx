import Link from "next/link";
import { getSettings } from "@/server/settings";
import { DemoBadge } from "./demo-badge";
import { SignOutButton } from "./sign-out-button";
import { Wordmark } from "./ui";

export type MastheadTab = { key: string; label: string; href: string };

type MastheadUser = { name?: string | null; email: string; isAdmin?: boolean };

// The newspaper masthead every screen opens with — the one navigation model of
// the Broadsheet interface. A dateline row in small caps (club name, and what
// this page is about), the wordmark, a heavy rule, and a row of text tabs
// under it with the active one underlined by the same rule. On a phone the tab
// row scrolls sideways; there is no hamburger and nothing is hidden. The
// member's name and Sign out sit at the right end of the dateline; a visitor
// on a demo deployment sees the Demo label there instead.
//
// `size="full"` is the member pages' nameplate (wordmark large and centred,
// the tagline under it); `slim` is one row — for the admin and the reader,
// where the page below needs the height.
export async function Masthead({
  dateline,
  user,
  tabs,
  active,
  trailing,
  size = "full",
  width = "narrow",
}: {
  /** What this page is, after the club name: "Issue No. 6 · June 2026". */
  dateline?: string;
  /** null only on a demo deployment (the gates redirect everyone else). */
  user: MastheadUser | null;
  tabs: MastheadTab[];
  /** The `key` of the active tab, if any. */
  active?: string;
  /** A way out at the right end of the tab row: "Back to library". */
  trailing?: MastheadTab;
  size?: "full" | "slim";
  width?: "narrow" | "wide";
}) {
  const { org, tagline } = await getSettings();
  const container = width === "wide" ? "max-w-6xl" : "max-w-5xl";
  const line = dateline ? `${org} · ${dateline}` : org;
  const displayName = user ? (user.name?.trim() ?? "") || user.email : "";

  const account = user ? (
    <nav
      aria-label="Account"
      className="flex min-w-0 items-center gap-3 sm:gap-4"
    >
      <span className="text-lead hidden truncate font-ui text-[15px] sm:inline">
        {displayName}
      </span>
      <SignOutButton />
    </nav>
  ) : (
    <DemoBadge />
  );

  return (
    <header className={`mx-auto w-full px-5 pt-4 sm:px-8 ${container}`}>
      {size === "full" ? (
        <>
          <div className="rule-hair flex min-h-11 items-center justify-between gap-4 pt-1">
            <p className="small-caps text-grey-soft truncate">{line}</p>
            {account}
          </div>
          <div className="py-5 text-center sm:py-7">
            <Link
              href="/"
              className="inline-block rounded-ui leading-none"
              aria-label="Back to the library"
            >
              <span className="hidden sm:inline">
                <Wordmark size={64} />
              </span>
              <span className="sm:hidden">
                <Wordmark size={40} />
              </span>
            </Link>
            {tagline && (
              <p className="text-grey mx-auto mt-3 max-w-2xl font-display text-[17px] italic text-balance sm:text-[19px]">
                {tagline}
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-6 gap-y-1 py-2">
          <div className="flex min-w-0 items-baseline gap-4">
            <Link
              href="/"
              className="rounded-ui leading-none"
              aria-label="Back to the library"
            >
              <Wordmark size={28} />
            </Link>
            <p className="small-caps text-grey-soft truncate">{line}</p>
          </div>
          {account}
        </div>
      )}

      <div className="rule-heavy" />
      <nav
        aria-label="Sections"
        className="scrollbar-soft -mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0"
      >
        <ul className="rule-hair flex items-stretch gap-1 whitespace-nowrap">
          {tabs.map((t) => (
            <li key={t.key}>
              <Tab tab={t} on={t.key === active} />
            </li>
          ))}
          {trailing && (
            <li className="ml-auto pl-4">
              <Tab tab={trailing} on={false} />
            </li>
          )}
        </ul>
      </nav>
    </header>
  );
}

function Tab({ tab, on }: { tab: MastheadTab; on: boolean }) {
  return (
    <Link
      href={tab.href}
      aria-current={on ? "page" : undefined}
      className={`-mb-px flex h-12 items-center border-b-[3px] px-3 font-ui text-[15px] font-semibold tracking-[0.08em] uppercase transition-colors first:pl-0 ${
        on
          ? "border-lead text-lead"
          : "text-grey hover:text-lead border-transparent"
      }`}
    >
      {tab.label}
    </Link>
  );
}

// The tabs every member page shows. Admin is UX only — /admin is gated
// server-side regardless (issue #4).
export function memberTabs(user: MastheadUser | null): MastheadTab[] {
  const tabs: MastheadTab[] = [
    { key: "latest", label: "Latest", href: "/" },
    { key: "archive", label: "Archive", href: "/archive" },
  ];
  if (user) {
    tabs.push({
      key: "preferences",
      label: "Email preferences",
      href: "/preferences",
    });
    if (user.isAdmin) tabs.push({ key: "admin", label: "Admin", href: "/admin" });
  }
  return tabs;
}
