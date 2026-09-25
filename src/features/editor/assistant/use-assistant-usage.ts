"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AI_USAGE_PATH,
  aiUsageSummarySchema,
  type AiUsageSummary,
} from "@/lib/ai-usage-summary";

// The month's assistant spend for the panel's footer and its budget-spent state
// (#309): fetched when the panel opens and again after every run. A failed
// fetch keeps the last figure; the route itself refuses a spent budget anyway.
export function useAssistantUsage(open: boolean) {
  const [usage, setUsage] = useState<AiUsageSummary | null>(null);
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(AI_USAGE_PATH, { cache: "no-store" });
      if (!res.ok) return;
      const parsed = aiUsageSummarySchema.safeParse(await res.json());
      if (parsed.success) setUsage(parsed.data);
    } catch {}
  }, []);
  useEffect(() => {
    // A fetch whose answer lands later, not a synchronous update.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) void refresh();
  }, [open, refresh]);
  return { usage, refresh };
}
