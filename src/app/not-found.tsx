import { Wordmark, Button } from "@/components/ui";

// Rendered per request so the proxy's CSP nonce reaches this page's
// scripts — a build-time static render bakes in no nonce, and 'strict-dynamic'
// would then block Next's bootstrap on any 404. Cost is nil (static content).
export const dynamic = "force-dynamic";

// 404 / "not a member yet" — friendly, never a raw error.
export default async function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="index-settings-card bg-card border-line flex min-h-[420px] w-full max-w-xl flex-col rounded-[5px] border p-10 shadow-[0_1px_3px_rgba(0,0,0,0.07)]">
        <Wordmark size={18} />
        <div className="my-auto">
          <p className="text-accent font-serif text-[15px] italic">
            404 — page not found
          </p>
          <h1 className="text-ink mt-3 font-sans font-bold text-4xl leading-[1.05]">
            Page not found.
          </h1>
          <p className="text-muted mt-4 max-w-prose font-sans text-[16px] leading-relaxed">
            This address may have changed, or the issue may no longer be
            available. Return to the library to find your next read.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button href="/">Back to the library</Button>
          <a
            href="/signin"
            className="text-accent font-sans text-[15px] font-medium underline underline-offset-[3px]"
          >
            Sign in
          </a>
        </div>
      </div>
    </main>
  );
}
