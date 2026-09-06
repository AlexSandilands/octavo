import { Masthead, memberTabs } from "@/components/masthead";
import { Button, Pill } from "@/components/ui";
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

export default async function PreferencesPage() {
  const user = await requireMemberOrRedirect("/preferences");
  const { name: magazineName } = await getSettings();

  // No user only happens in demo mode (the gate redirects a real signed-out
  // visitor). A demo visitor has no account to hold a preference, so say so
  // plainly rather than render a toggle that can't do anything.
  const member = user ? await getRecipientById(user.id) : null;
  const subscribed = member?.subscribed ?? false;

  return (
    <>
      <Masthead
        dateline="Email preferences"
        user={user}
        tabs={memberTabs(user)}
        active="preferences"
      />
      <main className="mx-auto max-w-5xl px-5 pb-10 sm:px-8">
        <div className="max-w-xl pt-8">
          <h1 className="text-lead font-display text-[36px] leading-tight font-semibold sm:text-[44px]">
            Email preferences
          </h1>
          {!user ? (
            <p className="text-grey mt-4 font-ui text-[17px] leading-relaxed">
              Sign in to {magazineName} to manage when we email you.
            </p>
          ) : (
            <>
              <p className="text-grey mt-4 font-ui text-[17px] leading-relaxed">
                Email me at{" "}
                <span className="text-lead font-semibold">{user.email}</span>{" "}
                when a new issue of {magazineName} is published.
              </p>

              <div className="rule-heavy mt-6 flex items-center gap-3 pt-4">
                <span className="text-grey font-ui text-[16px]">
                  Currently:
                </span>
                <Pill status={subscribed ? "Subscribed" : "Unsubscribed"} />
              </div>

              {/* One toggle. The desired next state is a fixed hidden value
                  (the opposite of the current one) and the button text says
                  exactly what pressing it does; the action derives *who* from
                  the session, never from the form. A native <form>/<button> is
                  keyboard-operable by default. */}
              <form className="mt-6" action={updateEmailPreferenceAction}>
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
            </>
          )}
        </div>
      </main>
    </>
  );
}
