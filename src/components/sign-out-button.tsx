"use client";

import { useState, useTransition } from "react";
import { signOutAction } from "@/app/signin/actions";
import { Icon } from "./icons";

// The sign-out control, shared by the library header, footer and admin sidebar.
// signOutAction deletes the session row and clears the cookie; then a full page
// load, because a server-action redirect or router.push() never commits under
// this app's CSP in a production build (src/proxy.ts, #296, #335). The action
// stays in a transition so a throw reaches the error boundary.
export function SignOutButton({
  variant = "inline",
}: {
  variant?: "inline" | "sidebar";
}) {
  const [pending, startTransition] = useTransition();
  const [leaving, setLeaving] = useState(false);
  const busy = pending || leaving;
  const sidebar = variant === "sidebar";
  return (
    <button
      type="button"
      disabled={busy}
      aria-busy={busy || undefined}
      onClick={() =>
        startTransition(async () => {
          await signOutAction();
          setLeaving(true);
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- the router.push() this rule wants is the bug (see comment above)
          window.location.assign("/signin");
        })
      }
      className={`text-muted hover:text-accent flex h-11 cursor-pointer items-center font-sans font-medium hover:underline disabled:cursor-wait ${
        sidebar ? "w-full gap-2 text-[14px]" : "text-sm whitespace-nowrap"
      }`}
    >
      {sidebar && <Icon name="chevronLeft" size={16} />}
      Sign out
    </button>
  );
}
