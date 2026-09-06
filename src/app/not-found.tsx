import { Wordmark, Button } from "@/components/ui";
import { getSettings } from "@/server/settings";

// Rendered per request so the proxy's CSP nonce reaches this page's
// scripts — a build-time static render bakes in no nonce, and 'strict-dynamic'
// would then block Next's bootstrap on any 404. Cost is nil (static content).
export const dynamic = "force-dynamic";

// 404 / "not a member yet" — friendly, never a raw error. One real action:
// signing in. (Joining the club is a conversation with the club, not a form.)
export default async function NotFound() {
  const settings = await getSettings();
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="border-lead bg-sheet flex w-full max-w-xl flex-col gap-8 border border-l-4 p-8 sm:p-10">
        <Wordmark size={20} />
        <div>
          <p className="small-caps text-red">404 — page not found</p>
          <h1 className="text-lead mt-3 font-display text-[36px] leading-[1.05] font-semibold text-balance sm:text-[44px]">
            You&apos;re not a member — yet.
          </h1>
          <p className="text-grey mt-4 max-w-prose font-ui text-[17px] leading-relaxed">
            {settings.name} is read by members of the {settings.org}. If
            you&apos;ve just joined, the link in your welcome email will let you
            in — or ask the club about joining.
          </p>
        </div>
        <div>
          <Button href="/signin" icon="arrowRight">
            Sign in
          </Button>
        </div>
      </div>
    </main>
  );
}
