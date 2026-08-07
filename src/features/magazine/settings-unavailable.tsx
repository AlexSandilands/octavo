"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

// What /admin/magazine shows instead of the settings form when the stored row
// could not be read (issue #126).
//
// The form is left out on purpose rather than rendered empty: an empty form is
// indistinguishable from a never-customised deployment, and one save from it
// would write NULL over the magazine name, club name and tagline that the whole
// site — mastheads, page footers, email subjects — reads from. No form, no
// save. The wording says that plainly, because the owner's first instinct on
// seeing their details "gone" is to type them back in.
//
// A client component only for the retry: router.refresh() re-runs this page's
// server render, which is exactly what a transient database blip needs.
export function SettingsUnavailable() {
  const router = useRouter();
  const [retrying, startRetry] = useTransition();

  return (
    <section
      role="alert"
      className="bg-card border-line mt-7 max-w-2xl rounded-[10px] border p-6 shadow-[0_1px_3px_rgba(0,0,0,0.07)]"
    >
      <div className="text-warn font-sans text-[11px] font-semibold tracking-[0.2em] uppercase">
        Couldn&rsquo;t load
      </div>
      <h2 className="text-ink mt-2 font-serif text-[22px] leading-tight">
        We can&rsquo;t show your magazine details right now.
      </h2>
      <p className="text-muted mt-3 max-w-prose font-sans text-[15px] leading-relaxed">
        The database didn&rsquo;t answer, so we don&rsquo;t know what your
        current settings are.{" "}
        <strong className="text-ink">Nothing has been changed</strong> — your
        saved details are still there. We&rsquo;ve left the form out rather than
        show you empty boxes, because saving those would wipe the details you
        can&rsquo;t see.
      </p>
      <p className="text-muted mt-3 max-w-prose font-sans text-[15px] leading-relaxed">
        Your logo library is on this page too, and comes back with it. Try again
        in a moment; if it keeps happening, note the time and let your developer
        know.
      </p>
      <div className="mt-5">
        <Button
          icon="refresh"
          iconPosition="left"
          variant="secondary"
          busy={retrying}
          onClick={() => startRetry(() => router.refresh())}
        >
          {retrying ? "Trying again…" : "Try again"}
        </Button>
      </div>
    </section>
  );
}
