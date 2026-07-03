import { Wordmark, Button } from "@/components/ui";
import { site } from "@/lib/site";

// 404 / "not a member yet" — friendly, never a raw error.
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="bg-card border-line flex min-h-[420px] w-full max-w-xl flex-col rounded-[5px] border p-10 shadow-[0_1px_3px_rgba(0,0,0,0.07)]">
        <Wordmark size={18} />
        <div className="my-auto">
          <p className="text-accent font-serif text-[15px] italic">
            404 — page not found
          </p>
          <h1 className="text-ink mt-3 font-serif text-4xl leading-[1.05]">
            You&apos;re not a
            <br />
            member — yet.
          </h1>
          <p className="text-muted mt-4 max-w-prose font-sans text-[16px] leading-relaxed">
            {site.name} is read by members of the {site.org}. If you&apos;ve
            just joined, the link in your welcome email will let you in.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button>Ask about joining</Button>
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
