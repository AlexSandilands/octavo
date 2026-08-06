"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";

// The one way the members list writes its state (?q=, ?filter=, ?page=) into
// the URL — search, filter and pagination all funnel through here so the
// contract lives once instead of drifting three ways. A `null` value removes
// its param (defaults stay out of the URL, keeping bare URLs bare). The
// params are read from the *live* URL at call time, not from a render-time
// useSearchParams snapshot: a debounced write must not resurrect state that
// another control changed while its timer was armed.
export function useListUrl() {
  const router = useRouter();
  const pathname = usePathname();
  return useCallback(
    (
      updates: Record<string, string | null>,
      method: "push" | "replace" = "push",
    ) => {
      const params = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) params.delete(key);
        else params.set(key, value);
      }
      const qs = params.toString();
      router[method](qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname],
  );
}
