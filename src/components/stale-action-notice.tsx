"use client";

import { Button } from "@/components/ui";
import {
  RELOAD_LABEL,
  STALE_NOTICE,
  STALE_NOTICE_TYPED,
} from "@/lib/stale-action";

// Inline counterpart of the route boundary's reload state (#402), for a caught
// Server Action rejection from an outdated page (#403). A full reload, not a
// retry; `typed` adds "copy what you wrote" where reloading clears a box.
export function StaleActionNotice({
  typed = false,
  className = "",
}: {
  typed?: boolean;
  className?: string;
}) {
  return (
    <span
      role="alert"
      data-stale-action
      className={`text-warn block font-sans text-[14px] leading-snug ${className}`}
    >
      {typed ? STALE_NOTICE_TYPED : STALE_NOTICE}{" "}
      <Button
        variant="secondary"
        size="compact"
        className="mt-2"
        onClick={() => window.location.reload()}
      >
        {RELOAD_LABEL}
      </Button>
    </span>
  );
}
