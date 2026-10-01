import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The assistant's system prompt (#308), assembled from one markdown file per
// part in a fixed order. It's product copy as much as code, and it must stay
// byte-stable across requests (no dates, no issue data) or the provider's
// prompt cache misses. `vision` is #342's, `cover` is #313's.

export type PromptFeatures = { vision?: boolean; cover?: boolean };

const DIR = join(process.cwd(), "src/server/ai-prompt");
const parts = new Map<string, string>();

function part(name: "base" | "vision" | "cover"): string {
  let text = parts.get(name);
  if (text === undefined) {
    text = readFileSync(join(DIR, `${name}.md`), "utf8").trim();
    parts.set(name, text);
  }
  return text;
}

export function systemPrompt(features: PromptFeatures = {}): string {
  return [
    part("base"),
    ...(features.vision ? [part("vision")] : []),
    ...(features.cover ? [part("cover")] : []),
  ].join("\n\n");
}
