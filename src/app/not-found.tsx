import { Button, Wordmark } from "@/components/ui";
import { Icon } from "@/components/icons";
import { getSettings } from "@/server/settings";

// Rendered per request so the proxy's CSP nonce reaches this page's
// scripts — a build-time static render bakes in no nonce, and 'strict-dynamic'
// would then block Next's bootstrap on any 404. Cost is nil (static content).
export const dynamic = "force-dynamic";

// 404 / "not a member yet" — friendly, never a raw error.
export default async function NotFound() {
  const settings = await getSettings();
  return (
    <main className="bg-ground flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="bg-surface border-hairline shadow-card w-full max-w-xl rounded-card border p-6 sm:p-9">
        <Wordmark size={18} />
        <div className="text-primary mt-8 flex items-center gap-2 font-ui text-[15px] font-bold">
          <Icon name="alertCircle" size={20} strokeWidth={2} />
          404 — page not found
        </div>
        <h1 className="text-fg mt-3 font-ui text-[30px] leading-[1.1] font-bold sm:text-[34px]">
          You&apos;re not a member — yet.
        </h1>
        <p className="text-fg-muted mt-4 max-w-prose font-ui text-[17px] leading-relaxed">
          {settings.name} is read by members of the {settings.org}. If
          you&apos;ve just joined, the link in your welcome email will let you
          in.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button href="/signin" icon="mail">
            Sign in
          </Button>
          <Button href="/" variant="secondary" icon="library">
            Back to the library
          </Button>
        </div>
      </div>
    </main>
  );
}
