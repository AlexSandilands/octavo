import {
  AI_MAX_TOOL_TEXT,
  aiToolSchemas,
  type AiToolName,
  type AiToolOutput,
} from "@/lib/ai-tools";
import type { AssistantIssue } from "./issue-context";
import { pageView } from "./projection";
import { clip } from "./projection-text";

// Runs the model's tool calls against the issue in the browser (#306): this
// issue's one tool reads; #310 adds the editing tools here. A bad argument or a
// refusal is an output the model reads, never a throw.
export function runAssistantTool(
  name: AiToolName,
  input: unknown,
  issue: AssistantIssue,
): AiToolOutput {
  switch (name) {
    case "read_page": {
      const args = aiToolSchemas.read_page.safeParse(input);
      if (!args.success)
        return { text: "read_page needs a page number, like { page: 3 }." };
      return { text: clip(pageView(issue, args.data.page), AI_MAX_TOOL_TEXT) };
    }
  }
}
