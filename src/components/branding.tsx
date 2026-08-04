"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Branding } from "@/lib/branding";

// The magazine's wording, published once by the root layout so the app chrome
// can name it anywhere. Server components resolve it themselves (getSettings())
// and pass values as props; this exists for the handful of places that have no
// server boundary to take a prop from — the route error boundary and the
// library's loading skeleton, both of which render the wordmark and neither of
// which can await a database read (a Suspense fallback that suspends shows
// nothing at all).
//
// It carries the branding text only. Page chrome — the running footer's mark
// size, type size and alignment — travels as an explicit `settings` prop
// instead, because the surfaces that draw a page include server-rendered ones
// (the print document, library thumbnails) that cannot read context at all.

const BrandingContext = createContext<Branding | null>(null);

export function BrandingProvider({
  value,
  children,
}: {
  value: Branding;
  children: ReactNode;
}) {
  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding(): Branding {
  const value = useContext(BrandingContext);
  // The root layout always provides it, so this is a wiring error, not a
  // runtime condition — say so rather than rendering an unnamed magazine.
  if (!value) {
    throw new Error(
      "useBranding() outside <BrandingProvider> — it is mounted in the root layout",
    );
  }
  return value;
}

/** The magazine's name as text. The leaf `Wordmark` and `Cover` render through
 *  it so those two keep working in server and client trees alike. */
export function MagazineName() {
  return <>{useBranding().name}</>;
}
