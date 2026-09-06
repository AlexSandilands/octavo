"use client";

import Link from "next/link";
import { useBranding } from "@/components/branding";
import { SheetFrame } from "@/components/sheet-frame";
import { Button } from "@/components/ui";

// Friendly full-page error state shared by the route error boundaries — a
// member (or the admin) never sees a raw stack trace (design-principles §10).
// A client tree, so the sheet's frame takes the org from the branding context.
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
  const { org } = useBranding();
  return (
    <SheetFrame org={org} width="max-w-xl">
      <p className="text-brass-ink font-meta text-[12px] font-medium tracking-[0.14em] uppercase">
        {kicker}
      </p>
      <h1 className="text-ink mt-3 font-display text-[36px] leading-[1.05]">
        {title}
      </h1>
      <p className="text-muted mt-4 max-w-prose font-ui text-[17px] leading-relaxed">
        {body}
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Button onClick={onRetry}>Try again</Button>
        <Link
          href="/"
          className="text-brass-ink rounded-ui font-ui text-[16px] font-medium underline underline-offset-[3px]"
        >
          Back to the library
        </Link>
      </div>
    </SheetFrame>
  );
}
