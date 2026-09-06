import { AppShell } from "@/components/app-shell";
import { SignOutButton } from "@/components/sign-out-button";
import { Avatar, Button, Pill } from "@/components/ui";
import { initials } from "@/lib/initials";
import { getSettings } from "@/server/settings";
import { getRecipientById } from "@/server/recipients";
import { requireMemberOrRedirect } from "@/server/session";
import { updateEmailPreferenceAction } from "./actions";

// The Account page (Compass): who you are signed in as, the one email setting
// a member can change without emailing the admin (issue #86), the way into
// the admin for those who have it, and Sign out. Gated by the same member
// check as the library — a signed-out visitor is bounced to /signin carrying
// this destination. This is the *session* path; the token-gated /unsubscribe
// page stays the email path. Both share setSubscribed.
export const dynamic = "force-dynamic";

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-surface border-hairline shadow-card rounded-card border p-5 sm:p-6">
      <h2 className="text-fg font-ui text-[20px] font-bold">{title}</h2>
      {children}
    </section>
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
      <AppShell area="member" active="account" user={null}>
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          <h1 className="text-fg font-ui text-[28px] font-bold sm:text-[34px]">
            Account
          </h1>
          <Card title="Email preferences">
            <p className="text-fg-muted mt-2 font-ui text-[17px] leading-relaxed">
              Sign in to {magazineName} to manage when we email you.
            </p>
            <div className="mt-5">
              <Button href="/signin" icon="mail">
                Sign in
              </Button>
            </div>
          </Card>
        </div>
      </AppShell>
    );
  }

  const member = await getRecipientById(user.id);
  const subscribed = member?.subscribed ?? false;
  const display = user.name?.trim() || user.email;

  return (
    <AppShell area="member" active="account" user={user}>
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        <h1 className="text-fg font-ui text-[28px] font-bold sm:text-[34px]">
          Account
        </h1>

        <section className="bg-surface border-hairline shadow-card flex items-center gap-4 rounded-card border p-5 sm:p-6">
          <Avatar initials={initials(display)} size={56} />
          <div className="min-w-0">
            <h2 className="text-fg truncate font-ui text-[20px] font-bold">
              {display}
            </h2>
            {user.name?.trim() && (
              <p className="text-fg-muted truncate font-ui text-[16px]">
                {user.email}
              </p>
            )}
          </div>
        </section>

        <Card title="Email preferences">
          <p className="text-fg-muted mt-2 font-ui text-[17px] leading-relaxed">
            Email me at <span className="text-fg font-bold">{user.email}</span>{" "}
            when a new issue of {magazineName} is published.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-fg-muted font-ui text-[16px]">
              Currently:
            </span>
            <Pill status={subscribed ? "Subscribed" : "Unsubscribed"} />
          </div>
          {/* One toggle. The desired next state is a fixed hidden value (the
              opposite of the current one) and the button text says exactly
              what pressing it does; the action derives *who* from the session,
              never from the form. */}
          <form className="mt-5" action={updateEmailPreferenceAction}>
            <input
              type="hidden"
              name="subscribe"
              value={subscribed ? "false" : "true"}
            />
            {subscribed ? (
              <Button type="submit" variant="secondary" icon="minus">
                Turn these emails off
              </Button>
            ) : (
              <Button type="submit" icon="check">
                Turn these emails on
              </Button>
            )}
          </form>
        </Card>

        {/* UX only — /admin is gated server-side regardless (issue #4). On a
            phone this is the way into the admin; the tab bar has no room. */}
        {user.isAdmin && (
          <Card title="Admin">
            <p className="text-fg-muted mt-2 font-ui text-[17px] leading-relaxed">
              Issues, members, sponsors and the magazine&apos;s details.
            </p>
            <div className="mt-5">
              <Button href="/admin" icon="shield">
                Open the admin
              </Button>
            </div>
          </Card>
        )}

        <SignOutButton variant="pill" />
      </div>
    </AppShell>
  );
}
