import Link from "next/link";
import { getSettings } from "@/server/settings";
import { SignInCard } from "../card";

// Rendered per request so the proxy's CSP nonce reaches this page's
// scripts — a build-time static render bakes in no nonce, and 'strict-dynamic'
// would then block Next's bootstrap here. Cost is nil (trivial static content).
export const dynamic = "force-dynamic";

// The neutral "check your email" screen. Every link request lands here,
// whether or not the address belongs to a member — the response must not
// reveal who is on the list.
export default async function SignInSentPage() {
  const { name, org } = await getSettings();
  return (
    <SignInCard>
      <h1 className="text-lead mt-10 font-display text-[44px] leading-[1.02] font-semibold">
        Check your email.
      </h1>
      <p className="text-grey mt-4 font-ui text-[17px] leading-relaxed">
        If that address belongs to a member of {org}, a sign-in link for {name}{" "}
        is on its way. Open the email and click the button — the link works once
        and lasts a day.
      </p>
      <p className="text-grey mt-4 font-ui text-[17px] leading-relaxed">
        Nothing arriving? Check your spam folder first.
      </p>
      <p className="mt-8 font-ui text-[16px]">
        <Link
          href="/signin"
          className="text-red inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
        >
          Use a different email address
        </Link>
      </p>
    </SignInCard>
  );
}
