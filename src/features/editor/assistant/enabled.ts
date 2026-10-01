// Whether this build offers the editing assistant (#306): NEXT_PUBLIC_AI_ASSISTANT
// is "1", inlined at build time. Unset hides the rail button; the route itself
// answers only when the server's `isAssistantEnabled()` agrees.
export const assistantEnabled = process.env.NEXT_PUBLIC_AI_ASSISTANT === "1";
