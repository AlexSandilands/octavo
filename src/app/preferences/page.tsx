import Link from "next/link";
import { Button, Label, Pill, Wordmark } from "@/components/ui";
import { getSettings } from "@/server/settings";
import { getRecipientById } from "@/server/recipients";
import { requireMemberOrRedirect } from "@/server/session";
import { updateEmailPreferenceAction } from "./actions";

// A deliberately tiny member self-service surface (issue #86): the one email
// setting a member can change without emailing the admin. Gated by the same
// member check as the library — a signed-out visitor is bounced to /signin
// carrying this destination. This is the *session* path; the token-gated
// /unsubscribe page stays the email path. Both share setSubscribed.
export const dynamic = "force-dynamic";

async function Frame({ children }: { children: React.ReactNode }) {
  const { org } = await getSettings();
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="bg-sheet border-hairline w-full max-w-md rounded-ui border p-8 sm:p-10">
        <Wordmark size={22} />
        <Label>{org}</Label>
        {children}
        <div className="border-hairline mt-8 border-t pt-6">
          <Link
            href="/"
            className="text-grey hover:text-red flex h-11 items-center font-ui text-sm font-medium hover:underline"
          >
            &larr; Back to the library
          </Link>
        </div>
      </div>
    </main>
  );
}

export default async function PreferencesPage() {
  const user = await requireMemberOrRedirect("/preferences");
  const { name: magazineName } = await getSettings();

  // No user only happens in demo mode (the gate redirects a real signed-out
  // visitor). A demo visitor has no account to hold a preference, so say so
  // plainly rather than render a toggle that can't do anything.
  if (!user) {
    return (
      <Frame>
        <h1 className="text-lead mt-10 font-display text-3xl leading-[1.1]">
          Email preferences
        </h1>
        <p className="text-grey mt-4 font-ui text-[16px] leading-relaxed">
          Sign in to {magazineName} to manage when we email you.
        </p>
      </Frame>
    );
  }

  const member = await getRecipientById(user.id);
  const subscribed = member?.subscribed ?? false;

  return (
    <Frame>
      <h1 className="text-lead mt-10 font-display text-3xl leading-[1.1]">
        Email preferences
      </h1>
      <p className="text-grey mt-4 font-ui text-[16px] leading-relaxed">
        Email me at <span className="text-lead font-semibold">{user.email}</span>{" "}
        when a new issue of {magazineName} is published.
      </p>

      <div className="mt-6 flex items-center gap-3">
        <span className="text-grey font-ui text-sm">Currently:</span>
        <Pill status={subscribed ? "Subscribed" : "Unsubscribed"} />
      </div>

      {/* One toggle. The desired next state is a fixed hidden value (the
          opposite of the current one) and the button text says exactly what
          pressing it does; the action derives *who* from the session, never
          from the form. A native <form>/<button> is keyboard-operable by
          default. */}
      <form className="mt-8" action={updateEmailPreferenceAction}>
        <input
          type="hidden"
          name="subscribe"
          value={subscribed ? "false" : "true"}
        />
        {subscribed ? (
          <Button type="submit" variant="secondary" full>
            Turn these emails off
          </Button>
        ) : (
          <Button type="submit" full>
            Turn these emails on
          </Button>
        )}
      </form>
    </Frame>
  );
}
