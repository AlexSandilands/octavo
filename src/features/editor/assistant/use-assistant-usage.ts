"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AI_USAGE_PATH,
  aiUsageSummarySchema,
  type AiUsageSummary,
} from "@/lib/ai-usage-summary";

// The month's assistant spend for the panel's footer and its budget-spent state
// (#309): fetched when the editor opens with the assistant on (so the Ask box
// knows a spent month before its first send, #311), when the panel opens, and
// after every run. A failed
// fetch keeps the last figure; the route itself refuses a spent budget anyway.
// `refresh` also answers with the figure, for the Ask box (#311).
export function useAssistantUsage(enabled: boolean, open: boolean) {
  const [usage, setUsage] = useState<AiUsageSummary | null>(null);
  const refresh = useCallback(async (): Promise<AiUsageSummary | null> => {
    try {
      const res = await fetch(AI_USAGE_PATH, { cache: "no-store" });
      if (!res.ok) return null;
      const parsed = aiUsageSummarySchema.safeParse(await res.json());
      if (!parsed.success) return null;
      setUsage(parsed.data);
      return parsed.data;
    } catch {
      return null;
    }
  }, []);
  const fetched = useRef(false);
  useEffect(() => {
    if (!enabled || (!open && fetched.current)) return;
    fetched.current = true;
    void refresh();
  }, [enabled, open, refresh]);
  return { usage, refresh };
}
