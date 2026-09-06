import Link from "next/link";
import { Icon } from "@/components/icons";

export function Masthead({
  org,
  tagline,
  hasRecent,
  latestNumber,
}: {
  org: string;
  tagline: string;
  hasRecent: boolean;
  latestNumber?: number;
}) {
  return (
    <aside className="harbour-welcome">
      <div className="mb-8 text-xs font-semibold tracking-widest uppercase">
        {org}
      </div>
      <h1>
        Make yourself
        <br />
        at home.
      </h1>
      <p className="mt-4">{tagline}</p>
      <nav aria-label="Member library" className="mt-8 space-y-2">
        <Link
          className="harbour-member-link"
          href={latestNumber ? `/read/${latestNumber}` : "/"}
          aria-current={latestNumber ? undefined : "page"}
        >
          <Icon name={latestNumber ? "doc" : "grid"} size={18} />
          {latestNumber ? "Read latest issue" : "Your library"}
        </Link>
        {hasRecent && (
          <Link href="#recent-issues">
            <Icon name="doc" size={18} />
            Back issues
          </Link>
        )}
      </nav>
      <div className="harbour-welcome-note mt-10 border-t border-white/25 pt-5">
        <span className="text-2xl" aria-hidden="true">
          ✦
        </span>
        <p className="mt-3">
          Club stories, shared with you. Settle in and enjoy a good read.
        </p>
      </div>
    </aside>
  );
}
