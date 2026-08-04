import { AdminShell } from "@/components/admin-shell";
import { LogosManager } from "@/features/logos/logos-manager";
import { MagazineSettings } from "@/features/magazine/magazine-settings";
import { listLogos } from "@/server/logos";
import { requireAdminOrRedirect } from "@/server/session";
import { getSettingsForAdmin } from "@/server/settings";

export const dynamic = "force-dynamic";

// Magazine details (issue #105): the two things about the publication itself
// that used to need a redeploy — what it calls itself and how its running
// footer is set — plus the logo library the footer's mark comes from. They
// share a page because they are one job: an owner setting up the magazine's
// identity. The settings half is a client island (it previews unsaved edits);
// the logo library below is the manager moved here wholesale from /admin/logos.
export default async function MagazinePage() {
  const admin = await requireAdminOrRedirect();
  const [{ stored, defaults }, logos] = await Promise.all([
    getSettingsForAdmin(),
    listLogos(),
  ]);
  return (
    <AdminShell active="magazine" user={admin}>
      <div className="pb-16">
        <h1 className="text-ink font-serif text-3xl">Magazine details</h1>
        <p className="text-faint mt-1.5 font-sans text-sm">
          What the magazine calls itself, and how the foot of every page is set.
          Changes go live as soon as you save — nothing needs rebuilding.
        </p>

        <MagazineSettings stored={stored} defaults={defaults} logos={logos} />

        <section className="border-line mt-14 border-t pt-10">
          <LogosManager logos={logos} />
        </section>
      </div>
    </AdminShell>
  );
}
