import type { ReactNode } from "react";
import { Wordmark, Label } from "@/components/ui";
import { getSettings } from "@/server/settings";

export async function SignInCard({ children }: { children: ReactNode }) {
  const { org, tagline } = await getSettings();
  return (
    <main className="folio-signin">
      <section className="folio-signin-story" aria-label="About the magazine">
        <Wordmark size={42} />
        <Label>{org}</Label>
        <p className="folio-signin-title">
          A good read.
          <br />
          <em>A familiar place.</em>
        </p>
        <p>{tagline}</p>
        <div className="folio-signin-steps">
          <span>01 &nbsp; Enter your email</span>
          <span>02 &nbsp; Open your private link</span>
          <span>03 &nbsp; Make yourself at home</span>
        </div>
      </section>
      <section className="folio-signin-form">
        <Wordmark size={24} />
        <Label>Members’ reading room</Label>
        {children}
      </section>
    </main>
  );
}
