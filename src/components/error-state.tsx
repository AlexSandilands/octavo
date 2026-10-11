"use client";

import { useEffect } from "react";
import Link from "next/link";
import { unstable_isUnrecognizedActionError } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { Button, Wordmark } from "@/components/ui";

// Friendly full-page error state shared by the route error boundaries — a
// member (or the admin) never sees a raw stack trace (design-principles §10).
export function ErrorState({
  kicker,
  title,
  body,
  onRetry,
  retryLabel = "Try again",
  contained = false,
}: {
  kicker: string;
  title: string;
  body: string;
  onRetry: () => void;
  retryLabel?: string;
  contained?: boolean;
}) {
  const Container = contained ? "div" : "main";
  return (
    <Container
      className={`flex ${contained ? "min-h-full" : "min-h-screen"} items-center justify-center px-5 py-12`}
    >
      <div className="bg-card border-line flex min-h-[420px] w-full max-w-xl flex-col rounded-[5px] border p-10 shadow-[0_1px_3px_rgba(0,0,0,0.07)]">
        <Wordmark size={18} />
        <div className="my-auto">
          <p className="text-accent font-serif text-[15px] italic">{kicker}</p>
          <h1 className="text-ink mt-3 font-serif text-4xl leading-[1.05]">
            {title}
          </h1>
          <p className="text-muted mt-4 max-w-prose font-sans text-[16px] leading-relaxed">
            {body}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button onClick={onRetry}>{retryLabel}</Button>
          <Link
            href="/"
            className="text-accent font-sans text-[15px] font-medium underline underline-offset-[3px]"
          >
            Back to the library
          </Link>
        </div>
      </div>
    </Container>
  );
}

// A route error.tsx's body: reports the error and shows its copy — unless a
// page open across a deploy called a Server Action the new build no longer has
// (#401). That is expected after every release, so it isn't reported, and only
// a full reload (not reset(), which keeps the stale bundle) recovers.
export function RouteErrorState({
  error,
  reset,
  logLabel,
  ...copy
}: {
  error: Error & { digest?: string };
  reset: () => void;
  logLabel: string;
  kicker: string;
  title: string;
  body: string;
  contained?: boolean;
}) {
  const stale: boolean = unstable_isUnrecognizedActionError(error);

  useEffect(() => {
    if (stale) return;
    // Server details stay in the server logs; the digest matches a report
    // ("it said try again") to them and to the event onRequestError captured.
    // Capture again so a client-only render error is reported too.
    console.error(logLabel, error.digest ?? error);
    Sentry.captureException(error);
  }, [error, logLabel, stale]);

  if (!stale) return <ErrorState {...copy} onRetry={reset} />;
  return (
    <ErrorState
      contained={copy.contained}
      kicker="The site has been updated"
      title="Please reload this page."
      body="A new version went live while this page was open, so what you just did wasn't saved. Reload the page and do it again."
      retryLabel="Reload page"
      onRetry={() => window.location.reload()}
    />
  );
}
