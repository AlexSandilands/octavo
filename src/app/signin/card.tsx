import type { ReactNode } from "react";
import { Wordmark, Label } from "@/components/ui";
import { getSettings } from "@/server/settings";

// Shared frame for the sign-in flow's screens (form, sent, errors) and the
// other one-thing pages (preferences, unsubscribe): a narrow column under a
// small nameplate and a heavy rule. Resolves the branding itself so the
// screens using it don't each have to.
export async function SignInCard({
  children,
  foot,
}: {
  children: ReactNode;
  /** Something under a closing rule — a way back, say. */
  foot?: ReactNode;
}) {
  const { org } = await getSettings();
  return (
    <main className="flex min-h-screen items-start justify-center px-5 py-10 sm:items-center sm:py-12">
      <div className="w-full max-w-md">
        <div className="rule-heavy pt-3">
          <Label>{org}</Label>
          <div className="mt-1">
            <Wordmark size={30} />
          </div>
        </div>
        {children}
        {foot && <div className="rule-heavy mt-8 pt-3">{foot}</div>}
      </div>
    </main>
  );
}
