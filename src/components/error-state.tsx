"use client";

import Link from "next/link";
import { Button, Wordmark } from "@/components/ui";

// Friendly full-page error state shared by the route error boundaries — a
// member (or the admin) never sees a raw stack trace (design-principles §10).
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
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
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
          <Button onClick={onRetry}>Try again</Button>
          <Link
            href="/"
            className="text-accent font-sans text-[15px] font-medium underline underline-offset-[3px]"
          >
            Back to the library
          </Link>
        </div>
      </div>
    </main>
  );
}
