"use client";

import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { createIssueAction } from "@/app/admin/actions";

// Creating a draft opens it, by a client navigation rather than the action's
// own redirect(): Next 16.3 emits the scripts for loading/error boundaries
// without the CSP nonce, and a server-action redirect re-renders from the root,
// so its response carries one of those and the strict CSP in src/proxy.ts stops
// the router applying the redirect at all (issue #276).
export function CreateIssueButton({
  children,
  iconPosition,
  className,
}: {
  children: ReactNode;
  iconPosition?: "left" | "right";
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      icon="plus"
      iconPosition={iconPosition}
      busy={pending}
      className={className}
      onClick={() =>
        startTransition(async () => {
          const id = await createIssueAction();
          router.push(`/admin/issues/${id}/edit`);
        })
      }
    >
      {pending ? "Creating…" : children}
    </Button>
  );
}
