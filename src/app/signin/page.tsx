import { Wordmark, Button, Label } from "@/components/ui";
import { site } from "@/lib/site";

// Step 01 — enter your email. The "check inbox" and "expired" states are
// separate routes/states wired up when auth is built (see docs/SPEC.md §2).
export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="bg-card border-line w-full max-w-md rounded-2xl border p-8 shadow-[0_14px_34px_rgba(0,0,0,0.08)] sm:p-10">
        <Wordmark size={22} />
        <Label>{site.org}</Label>

        <h1 className="text-ink mt-12 font-serif text-4xl leading-[1.05]">
          Welcome
          <br />
          back.
        </h1>
        <p className="text-muted mt-4 font-sans text-[16px] leading-relaxed">
          Members read {site.name} with a private link. Enter your email and
          we&apos;ll send one over.
        </p>

        <form className="mt-8">
          <label className="text-faint font-sans text-xs font-semibold tracking-wide uppercase">
            Email
          </label>
          <input
            type="email"
            placeholder="you@example.com"
            className="border-hair text-ink mt-2 h-14 w-full rounded-[10px] border-[1.5px] bg-white px-4 font-sans text-[17px] outline-none focus:border-accent"
          />
          <div className="mt-3">
            <Button type="submit" icon="arrowRight" full>
              Email me a link
            </Button>
          </div>
          <p className="text-faint mt-4 text-center font-sans text-[13px]">
            No password to remember.
          </p>
        </form>
      </div>
    </main>
  );
}
