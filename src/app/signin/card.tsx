import type { ReactNode } from "react";
import { Wordmark } from "@/components/ui";
import { getSettings } from "@/server/settings";

// Shared frame for the sign-in flow's screens (form, sent, errors). Resolves
// the branding itself so the two screens using it don't each have to.
export async function SignInCard({ children }: { children: ReactNode }) {
  const { org, tagline } = await getSettings();
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="index-signin w-full">
        <div className="index-signin-intro">
          <div className="font-mono text-xs uppercase">
            {org} / Member access
          </div>
          <h2 className="text-5xl font-bold leading-none tracking-tight sm:text-6xl">
            Your next
            <br />
            good read.
          </h2>
          <p className="max-w-xs text-lg">{tagline}</p>
        </div>
        <div className="index-signin-form">
          <Wordmark size={28} />
          {children}
        </div>
      </div>
    </main>
  );
}
