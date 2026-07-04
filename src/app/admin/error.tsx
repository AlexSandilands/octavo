"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { ErrorState } from "@/components/error-state";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin route error", error.digest ?? error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <ErrorState
      kicker="Something went wrong"
      title="The admin area hit a snag."
      body="Your saved work is safe in the database. Try again — and if this keeps happening, note what you were doing and let your developer know."
      onRetry={reset}
    />
  );
}
