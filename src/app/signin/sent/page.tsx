import { Icon } from "@/components/icons";
import { Button } from "@/components/ui";
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
      <div className="bg-ok-soft text-ok mt-8 flex h-14 w-14 items-center justify-center rounded-full">
        <Icon name="mail" size={28} strokeWidth={1.9} />
      </div>
      <h1 className="text-fg mt-4 font-ui text-[32px] leading-[1.1] font-bold">
        Check your email
      </h1>
      <p className="text-fg-muted mt-3 font-ui text-[17px] leading-relaxed">
        If that address belongs to a member of {org}, a sign-in link for {name}{" "}
        is on its way. Open the email and press the button — the link works once
        and lasts a day.
      </p>
      <p className="text-fg-muted mt-4 font-ui text-[17px] leading-relaxed">
        Nothing arriving? Check your spam folder first.
      </p>
      <div className="mt-7">
        <Button href="/signin" variant="secondary" icon="arrowLeft" full>
          Use a different email address
        </Button>
      </div>
    </SignInCard>
  );
}
