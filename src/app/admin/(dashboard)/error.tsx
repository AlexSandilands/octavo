"use client";

import { RouteErrorState } from "@/components/error-state";

export default function AdminError({
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
      logLabel="Admin route error"
      contained
      kicker="Something went wrong"
      title="The admin area hit a snag."
      body="Your saved work is safe in the database. Try again — and if this keeps happening, note what you were doing and let your developer know."
    />
  );
}
