import Link from "next/link";
import { Button, Label, Pill, Wordmark } from "@/components/ui";
import { site } from "@/lib/site";
import { getRecipientById } from "@/server/recipients";
import { requireMemberOrRedirect } from "@/server/session";
import { updateEmailPreferenceAction } from "./actions";

// A deliberately tiny member self-service surface (issue #86): the one email
// setting a member can change without emailing the admin. Gated by the same
// member check as the library — a signed-out visitor is bounced to /signin
// carrying this destination. This is the *session* path; the token-gated
// /unsubscribe page stays the email path. Both share setSubscribed.
export const dynamic = "force-dynamic";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="bg-card border-line w-full max-w-md rounded-2xl border p-8 shadow-[0_14px_34px_rgba(0,0,0,0.08)] sm:p-10">
        <Wordmark size={22} />
        <Label>{site.org}</Label>
        {children}
        <div className="border-line mt-8 border-t pt-6">
          <Link
            href="/"
            className="text-muted hover:text-accent flex h-11 items-center font-sans text-sm font-medium hover:underline"
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

  // No user only happens in demo mode (the gate redirects a real signed-out
  // visitor). A demo visitor has no account to hold a preference, so say so
  // plainly rather than render a toggle that can't do anything.
  if (!user) {
    return (
      <Frame>
        <h1 className="text-ink mt-10 font-serif text-3xl leading-[1.1]">
          Email preferences
        </h1>
        <p className="text-muted mt-4 font-sans text-[16px] leading-relaxed">
          Sign in to {site.name} to manage when we email you.
        </p>
      </Frame>
    );
  }

  const member = await getRecipientById(user.id);
  const subscribed = member?.subscribed ?? false;

  return (
    <Frame>
      <h1 className="text-ink mt-10 font-serif text-3xl leading-[1.1]">
        Email preferences
      </h1>
      <p className="text-muted mt-4 font-sans text-[16px] leading-relaxed">
        Email me at <span className="text-ink font-semibold">{user.email}</span>{" "}
        when a new issue of {site.name} is published.
      </p>

      <div className="mt-6 flex items-center gap-3">
        <span className="text-muted font-sans text-sm">Currently:</span>
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
