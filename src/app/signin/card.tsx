import type { ReactNode } from "react";
import { Wordmark, Label } from "@/components/ui";
import { getSettings } from "@/server/settings";

// Shared frame for the sign-in flow's screens (form, sent, errors). Resolves
// the branding itself so the two screens using it don't each have to.
export async function SignInCard({ children }: { children: ReactNode }) {
  const { org } = await getSettings();
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="bg-sheet border-hairline w-full max-w-md rounded-ui border p-8 sm:p-10">
        <Wordmark size={22} />
        <Label>{org}</Label>
        {children}
      </div>
    </main>
  );
}
