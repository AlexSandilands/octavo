import "server-only";
import { env } from "@/lib/env";

// The one answer to "is the assistant on" (#308): a provider is configured.
// NEXT_PUBLIC_AI_ASSISTANT mirrors it for the editor's button; this decides.
export function isAssistantEnabled(): boolean {
  return env.AI_PROVIDER !== undefined;
}
