import type { ReactNode } from "react";
import { Chip, Wordmark } from "@/components/ui";
import { getSettings } from "@/server/settings";

// Shared frame for the screens that stand outside the shell — sign-in, its
// "sent" screen and the session-less unsubscribe page: one centred card on
// the ground with the wordmark and the club's name. Resolves the branding
// itself so the screens using it don't each have to.
export async function SignInCard({ children }: { children: ReactNode }) {
  const { org } = await getSettings();
  return (
    <main className="bg-ground flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="bg-surface border-hairline shadow-float w-full max-w-md rounded-card border p-6 sm:p-9">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Wordmark size={22} />
          <Chip tone="primary">{org}</Chip>
        </div>
        {children}
      </div>
    </main>
  );
}
