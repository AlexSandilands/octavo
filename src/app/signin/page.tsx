import { z } from "zod";
import { Button } from "@/components/ui";
import { site } from "@/lib/site";
import { SignInCard } from "./card";
import { requestMagicLink } from "./actions";

// Sign-in — enter your email, get a magic link. Also serves as Auth.js's
// error page (?error=...): the common case is Verification, an expired or
// already-used link, which becomes an invitation to request a fresh one.
const ERROR_COPY: Record<string, { title: string; body: string }> = {
  Verification: {
    title: "That link has expired.",
    body: "Sign-in links only work once and expire after a day. Enter your email and we'll send you a fresh one.",
  },
  "invalid-email": {
    title: "That doesn't look like an email address.",
    body: "Check for typos and try again.",
  },
};

const GENERIC_ERROR = {
  title: "Something went wrong.",
  body: "We couldn't sign you in just now. Enter your email and we'll send you a new link.",
};

// ?error= is external input (Next may even hand back string[] for a
// duplicated key) — validate at the boundary like everything else.
const paramsSchema = z.object({ error: z.string().optional() });

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = paramsSchema.safeParse(await searchParams);
  const error = parsed.success ? parsed.data.error : "unknown";
  const notice = error ? (ERROR_COPY[error] ?? GENERIC_ERROR) : null;

  return (
    <SignInCard>
      <h1 className="text-ink mt-12 font-serif text-4xl leading-[1.05]">
        Welcome
        <br />
        back.
      </h1>
      {notice ? (
        <div
          role="alert"
          className="border-hair bg-paper mt-6 rounded-[10px] border-[1.5px] p-4"
        >
          <p className="text-ink font-sans text-[15px] font-semibold">
            {notice.title}
          </p>
          <p className="text-muted mt-1 font-sans text-[15px] leading-relaxed">
            {notice.body}
          </p>
        </div>
      ) : (
        <p className="text-muted mt-4 font-sans text-[16px] leading-relaxed">
          Members read {site.name} with a private link. Enter your email and
          we&apos;ll send one over.
        </p>
      )}

      <form className="mt-8" action={requestMagicLink}>
        <label
          htmlFor="email"
          className="text-faint font-sans text-xs font-semibold tracking-wide uppercase"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
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
    </SignInCard>
  );
}
