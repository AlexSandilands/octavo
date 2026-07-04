import { SignOutButton } from "@/components/sign-out-button";
import { site } from "@/lib/site";

// A hairline-bordered close to the page: who publishes it, how many issues exist
// and since when, and a way out. Everyone reaching `/` is a signed-in member
// (the page is gated), so the account affordance is sign-out, not sign-in.
export function SiteFooter({
  issueCount,
  estYear,
}: {
  issueCount: number;
  estYear: number | null;
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
        <SignOutButton />
      </div>
    </footer>
  );
}
