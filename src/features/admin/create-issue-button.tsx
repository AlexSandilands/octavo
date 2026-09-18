"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui";
import { createIssueAction } from "@/app/admin/actions";

// Hard-navigates itself (not router.push) — under this app's CSP a
// client-side transition intermittently never commits in a production build
// (src/proxy.ts, #276, #296); a real navigation isn't subject to that race.
export function CreateIssueButton({
  children,
  iconPosition,
  className,
}: {
  children: ReactNode;
  iconPosition?: "left" | "right";
  className?: string;
}) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      icon="plus"
      iconPosition={iconPosition}
      busy={pending}
      className={className}
      onClick={async () => {
        setPending(true);
        const id = await createIssueAction();
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- the router.push() this rule wants is the bug (see comment above)
        window.location.assign(`/admin/issues/${id}/edit`);
      }}
    >
      {pending ? "Creating…" : children}
    </Button>
  );
}
