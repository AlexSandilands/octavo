import { SheetPage } from "@/components/sheet-page";
import { Button } from "@/components/ui";
import { getSettings } from "@/server/settings";

// Rendered per request so the proxy's CSP nonce reaches this page's
// scripts — a build-time static render bakes in no nonce, and 'strict-dynamic'
// would then block Next's bootstrap on any 404. Cost is nil (static content).
export const dynamic = "force-dynamic";

// 404 / "not a member yet" — friendly, never a raw error.
export default async function NotFound() {
  const settings = await getSettings();
  return (
    <SheetPage width="max-w-xl">
      <p className="text-brass-ink font-meta text-[12px] font-medium tracking-[0.14em] uppercase">
        404 — page not found
      </p>
      <h1 className="text-ink mt-3 font-display text-[36px] leading-[1.05]">
        You&apos;re not a
        <br />
        member — yet.
      </h1>
      <p className="text-muted mt-4 max-w-prose font-ui text-[17px] leading-relaxed">
        {settings.name} is read by members of the {settings.org}. If you&apos;ve
        just joined, the link in your welcome email will let you in.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Button>Ask about joining</Button>
        <a
          href="/signin"
          className="text-brass-ink rounded-ui font-ui text-[16px] font-medium underline underline-offset-[3px]"
        >
          Sign in
        </a>
      </div>
    </SheetPage>
  );
}
