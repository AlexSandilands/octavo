"use client";

import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { createIssueAction } from "@/app/admin/actions";

// Navigates itself instead of the action calling redirect(): under this app's
// CSP a server-action redirect never lands in a production build
// (src/proxy.ts, #276).
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
