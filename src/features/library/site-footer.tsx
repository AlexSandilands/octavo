import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui";

// The close of a library page: who publishes it, how many issues exist and
// since when, and a way out. Everyone reaching `/` signed in gets the sign-out
// affordance; an anonymous demo-mode visitor (issue #50) has no session to
// end, so the button is simply omitted.
export function SiteFooter({
  org,
  issueCount,
  estYear,
  signedIn,
}: {
  org: string;
  issueCount: number;
  estYear: number | null;
  signedIn: boolean;
}) {
  return (
    <footer className="border-hairline mt-12 flex flex-col gap-4 border-t py-8 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-chrome-text font-display text-[17px]">{org}</div>
        <div className="text-chrome-muted mt-1 font-meta text-[12px] tracking-[0.1em] uppercase">
          {issueCount} {issueCount === 1 ? "issue" : "issues"}
          {estYear ? ` · Est. ${estYear}` : ""}
        </div>
      </div>
      {signedIn && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            href="/preferences"
            variant="ghost"
            tone="dark"
            size="sm"
            icon="mail"
            iconPosition="left"
          >
            Email preferences
          </Button>
          <SignOutButton />
        </div>
      )}
    </footer>
  );
}
