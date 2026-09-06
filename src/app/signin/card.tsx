import type { ReactNode } from "react";
import { Wordmark, Label } from "@/components/ui";
import { getSettings } from "@/server/settings";

export async function SignInCard({ children }: { children: ReactNode }) {
  const { org, tagline } = await getSettings();
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="harbour-signin">
        <aside className="harbour-signin-story">
          <span className="text-sm font-semibold tracking-widest uppercase">
            {org}
          </span>
          <div>
            <div aria-hidden="true" className="mb-7 text-5xl text-[#f0d8a7]">
              ✦
            </div>
            <h2>
              Your club.
              <br />
              Your stories.
              <br />
              Your place.
            </h2>
            <p className="mt-6">{tagline}</p>
          </div>
          <p className="mt-8 text-sm">A private library for our members.</p>
        </aside>
        <div className="harbour-signin-form">
          <Wordmark size={25} />
          <Label>Member access</Label>
          {children}
        </div>
      </div>
    </main>
  );
}
