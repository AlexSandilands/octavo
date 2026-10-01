"use client";

import { useLoneRule } from "./use-lone-rule";

// The thin rule between a block bar's groups. Must sit directly before the
// control it introduces: it steps out of the way where the bar wraps and
// would leave it hanging alone (#377).
export function BarRule() {
  const ref = useLoneRule<HTMLSpanElement>();
  return <span ref={ref} className="bg-line h-5 w-px flex-none" />;
}
