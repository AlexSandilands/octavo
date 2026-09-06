"use client";

import { Button, Wordmark } from "@/components/ui";
import { Icon } from "@/components/icons";

// Friendly full-page error state shared by the route error boundaries — a
// member (or the admin) never sees a raw stack trace (design-principles §10).
// A card with a red bar down its left edge and a Try again pill.
export function ErrorState({
  kicker,
  title,
  body,
  onRetry,
}: {
  kicker: string;
  title: string;
  body: string;
  onRetry: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="bg-surface border-hairline shadow-card border-l-danger w-full max-w-xl overflow-hidden rounded-card border border-l-[6px] p-6 sm:p-9">
        <Wordmark size={18} />
        <div className="text-danger mt-8 flex items-center gap-2 font-ui text-[15px] font-bold">
          <Icon name="alertCircle" size={20} strokeWidth={2} />
          {kicker}
        </div>
        <h1 className="text-fg mt-3 font-ui text-[30px] leading-[1.1] font-bold sm:text-[34px]">
          {title}
        </h1>
        <p className="text-fg-muted mt-4 max-w-prose font-ui text-[17px] leading-relaxed">
          {body}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button onClick={onRetry} icon="refresh">
            Try again
          </Button>
          <Button href="/" variant="secondary" icon="library">
            Back to the library
          </Button>
        </div>
      </div>
    </main>
  );
}
