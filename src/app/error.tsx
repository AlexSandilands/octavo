"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/error-state";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-side details stay in the server logs; log the digest here so a
    // member's report ("it said try again") can be matched to them.
    console.error("Route error", error.digest ?? error);
  }, [error]);

  return (
    <ErrorState
      kicker="Something went wrong"
      title="We couldn't open that page."
      body="It's not you — something on our side didn't respond. Give it another try; if it keeps happening, it usually rights itself in a few minutes."
      onRetry={reset}
    />
  );
}
