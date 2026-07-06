import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { site } from "@/lib/site";

// A hairline-bordered close to the page: who publishes it, how many issues exist
// and since when, and a way out. Everyone reaching `/` signed in gets the
// sign-out affordance; an anonymous demo-mode visitor (issue #50) has no
// session to end, so the button is simply omitted.
export function SiteFooter({
  issueCount,
  estYear,
  signedIn,
}: {
  issueCount: number;
  estYear: number | null;
  signedIn: boolean;
}) {
  return (
    <footer className="border-line text-faint2 mt-4 flex flex-col gap-3 border-t py-8 font-sans text-[13px] sm:flex-row sm:items-center sm:justify-between">
      <div className="text-muted font-serif text-[15px]">{site.org}</div>
      {/* Baseline-align so "Sign out" sits on the same line as the issue-count
          text despite the button's taller (44px) tap target. */}
      <div className="flex items-baseline gap-5">
        <span>
          {issueCount} {issueCount === 1 ? "issue" : "issues"}
          {estYear ? ` · Est. ${estYear}` : ""}
        </span>
        {signedIn && (
          <>
            <Link
              href="/preferences"
              className="text-muted hover:text-accent flex h-11 items-center font-sans text-sm font-medium whitespace-nowrap hover:underline"
            >
              Email preferences
            </Link>
            <SignOutButton />
          </>
        )}
      </div>
    </footer>
  );
}
