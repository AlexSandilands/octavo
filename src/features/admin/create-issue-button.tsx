"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui";
import { createIssueAction } from "@/app/admin/actions";

// Hard-navigates rather than router.push(): under this app's CSP that client
// transition sometimes never commits in a production build (src/proxy.ts, #276,
// #296). The action stays in a transition so a throw reaches the error boundary.
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
