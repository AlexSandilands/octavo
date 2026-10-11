"use client";

import { RouteErrorState } from "@/components/error-state";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorState
      error={error}
      reset={reset}
      logLabel="Route error"
      kicker="Something went wrong"
      title="We couldn't open that page."
      body="It's not you — something on our side didn't respond. Give it another try; if it keeps happening, it usually rights itself in a few minutes."
    />
  );
}
