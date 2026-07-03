import Link from "next/link";
import { site } from "@/lib/site";
import { SignInCard } from "../card";

// Rendered per request so the middleware's CSP nonce reaches this page's
// scripts — a build-time static render bakes in no nonce, and 'strict-dynamic'
// would then block Next's bootstrap here. Cost is nil (trivial static content).
export const dynamic = "force-dynamic";

// The neutral "check your email" screen. Every link request lands here,
// whether or not the address belongs to a member — the response must not
// reveal who is on the list.
export default function SignInSentPage() {
  return (
    <SignInCard>
      <h1 className="text-ink mt-12 font-serif text-4xl leading-[1.05]">
        Check your
        <br />
        email.
      </h1>
      <p className="text-muted mt-4 font-sans text-[16px] leading-relaxed">
        If that address belongs to a member of {site.org}, a sign-in link for{" "}
        {site.name} is on its way. Open the email and click the button — the
        link works once and lasts a day.
      </p>
      <p className="text-muted mt-4 font-sans text-[16px] leading-relaxed">
        Nothing arriving? Check your spam folder first.
      </p>
      <p className="mt-8 font-sans text-[15px]">
        <Link
          href="/signin"
          className="text-accent font-semibold underline underline-offset-2"
        >
          Use a different email address
        </Link>
      </p>
    </SignInCard>
  );
}
