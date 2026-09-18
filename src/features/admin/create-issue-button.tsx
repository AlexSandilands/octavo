"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui";
import { createIssueAction } from "@/app/admin/actions";

// Hard-navigates itself (not router.push) — under this app's CSP a
// client-side transition intermittently never commits in a production build
// (src/proxy.ts, #276, #296); a real navigation isn't subject to that race.
// The action itself still runs in a transition, so a throw (a dropped
// connection, an expired session) reaches the admin error boundary instead
// of stranding the button.
export function CreateIssueButton({
  children,
  iconPosition,
  className,
}: {
  children: ReactNode;
  iconPosition?: "left" | "right";
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [leaving, setLeaving] = useState(false);
  const busy = pending || leaving;
  return (
    <Button
      icon="plus"
      iconPosition={iconPosition}
      busy={busy}
      className={className}
      onClick={() =>
        startTransition(async () => {
          const id = await createIssueAction();
          setLeaving(true);
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- the router.push() this rule wants is the bug (see comment above)
          window.location.assign(`/admin/issues/${id}/edit`);
        })
      }
    >
      {busy ? "Creating…" : children}
    </Button>
  );
}
