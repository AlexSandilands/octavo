// The assistant's model-selection fixture (#315). Runs the fixture's cases
// (scripts/fixtures/assistant/cases) through the chat route's own logic
// in-process, with the given provider and model, the editor's real executor
// for the tools and its real measurer for fill, then scores every run and
// prints a table and a verdict. It SPENDS REAL MONEY on any provider but
// `fake`, says roughly how much, and asks first.
//
// Needs a running app for the pages' CSS and fonts (the measurer lays pages
// out in headless Chromium with them): `PORT=3315 npm run dev`, then
//   npx tsx --tsconfig scripts/tsconfig.json scripts/check-assistant-models.mts \
//     --app http://localhost:3315 --provider fake            # free: the harness itself
//   … --provider anthropic --model claude-sonnet-5 --repeat 3
//   … --provider openrouter --model openai/gpt-6-sol        # needs OPENROUTER_API_KEY
// Keys come from .env.local. Options: --case 03,08 (a subset), --repeat N,
// --photos <dir> (real photos for cases that accept them; never commit them),
// --yes (skip the spend question). JSON, page views and PNGs go to the
// git-ignored scripts/assistant-models/results/.
// The next/image hook has to be registered before any app module is resolved,
// and static imports all resolve first, so the runner is loaded after it.
import "./assistant-models/next-image-hook.mts";

await import("./assistant-models/main.mts");
