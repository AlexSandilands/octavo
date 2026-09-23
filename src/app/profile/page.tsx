import { EmailPreferences } from "@/features/profile/email-preferences";
import { NamesSection } from "@/features/profile/names-section";
import { ProfileFrame } from "@/features/profile/profile-frame";
import { getEmailPreferences, getProfileNames } from "@/server/member-profile";
import { requireMemberOrRedirect } from "@/server/session";
import { getSettings } from "@/server/settings";

// The member's own page (issue #300, grown from #86's /preferences): the names
// they post under, a photo for each, and both email settings. The Names
// section and the reply-email toggle wait for discussion to be switched on.
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireMemberOrRedirect("/profile");
  const settings = await getSettings();

  // No user only happens in demo mode: there is no account to hold a profile.
  if (!user) {
    return (
      <ProfileFrame>
        <h1 className="text-ink mt-10 font-serif text-3xl leading-[1.1]">
          Your profile
        </h1>
        <p className="text-muted mt-4 font-sans text-[16px] leading-relaxed">
          Sign in to {settings.name} to manage your profile and when we email
          you.
        </p>
      </ProfileFrame>
    );
  }

  const discussion = settings.commentsEnabled;
  const [prefs, names] = await Promise.all([
    getEmailPreferences(user.id),
    discussion ? getProfileNames(user.id) : [],
  ]);

  return (
    <ProfileFrame>
      <h1 className="text-ink mt-10 font-serif text-3xl leading-[1.1]">
        Your profile
      </h1>
      {discussion && (
        <NamesSection
          names={names}
          isAdmin={user.isAdmin}
          suggestion={names.length === 0 ? (prefs?.name?.trim() ?? "") : ""}
          accountName={prefs?.name ?? null}
          reserved={[settings.name, settings.org]}
        />
      )}
      <EmailPreferences
        email={user.email}
        magazineName={settings.name}
        subscribed={prefs?.subscribed ?? false}
        replyEmails={prefs?.replyEmails ?? false}
        showReplyEmails={discussion}
      />
    </ProfileFrame>
  );
}
