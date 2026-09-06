import { AdminPageHeader } from "@/components/admin-page-header";
import { AppShell } from "@/components/app-shell";
import { MagazineSettings } from "@/features/magazine/magazine-settings";
import { SettingsUnavailable } from "@/features/magazine/settings-unavailable";
import { listLogos } from "@/server/logos";
import { requireAdminOrRedirect } from "@/server/session";
import { getSettingsForAdmin } from "@/server/settings";

export const dynamic = "force-dynamic";

// Magazine details (issue #105): the two things about the publication itself
// that used to need a redeploy — what it calls itself and how its running
// footer is set — plus the logo library the footer's mark comes from. They
// share a page because they are one job: an owner setting up the magazine's
// identity, and each is a card in the same column. This route only gates and
// loads; the whole page is one client island, because the preview beside the
// cards renders edits before they are saved.
export default async function MagazinePage() {
  const admin = await requireAdminOrRedirect();
  const [settings, logos] = await Promise.all([
    getSettingsForAdmin(),
    listLogos(),
  ]);
  return (
    <AppShell area="admin" active="magazine" user={admin}>
      <div className="pb-16">
        <AdminPageHeader
          title="Magazine details"
          summary="What the magazine calls itself, how the foot of every page is set, and whether members can download an issue. Changes go live as soon as you save — nothing needs rebuilding."
        />

        {/* The form is only ever mounted with a row we actually read. That is
            the whole guarantee behind issue #126: the save sends every field,
            so a form seeded from a failed read would save empties over the
            stored branding — and this is the one place the form exists. */}
        {settings.ok ? (
          <MagazineSettings
            stored={settings.stored}
            defaults={settings.defaults}
            logos={logos}
          />
        ) : (
          <SettingsUnavailable />
        )}
      </div>
    </AppShell>
  );
}
