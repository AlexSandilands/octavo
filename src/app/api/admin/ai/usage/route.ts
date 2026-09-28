import { NextResponse } from "next/server";
import { isAssistantEnabled } from "@/lib/ai";
import { DEFAULT_ANTHROPIC_MODEL } from "@/lib/env";
import type { AiUsageSummary } from "@/lib/ai-usage-summary";
import { resolveBudget } from "@/server/ai-budget";
import { aiErrorResponse } from "@/server/ai-errors";
import { assistantModel } from "@/server/ai-provider";
import { getAdminUser } from "@/server/session";

// This month's assistant spend against its allowance (#309): the editor panel's
// footer and its budget-spent state, and #314's page. The same `resolveBudget()`
// the chat route refuses on, so the two can't disagree. Off → 404, like the chat.
export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return aiErrorResponse("unauthorised");
  if (!isAssistantEnabled()) return new Response(null, { status: 404 });
  const { month, allowance, granted, spent, remaining } = await resolveBudget();
  // The fake is estimated as the default model, so gates and the demo show a
  // real figure.
  const modelId = assistantModel()?.modelId;
  const model =
    !modelId || modelId === "fake" ? DEFAULT_ANTHROPIC_MODEL : modelId;
  const body: AiUsageSummary = {
    month,
    allowance,
    granted,
    spent,
    remaining,
    model,
  };
  return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
}
