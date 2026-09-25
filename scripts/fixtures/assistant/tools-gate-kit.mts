// The scratch issue and small helpers for dev-assistant-tools-gate.mts (#310):
// a cover, a page with a heading, an intro, a photo and a story, and a page
// after it; lookups over a saved document; a poll with a deadline; and a watch
// on the chat's requests that runs `[fake:tools]` scripts and reads what went
// back.
import type { Page } from "playwright";

/** The issue photo the page places; its row has no file behind it. */
export const photoId = crypto.randomUUID();

export type Block = { id: string; type: string; [k: string]: unknown };
export type Doc = { pages: { id: string; cover?: boolean; blocks: Block[] }[] };
export const para = (text: string) => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});
export const text = (id: string, paras: string[]): Block => ({
  id,
  type: "text",
  text: { type: "doc", content: paras.map(para) },
});
export const ids = {
  cover: crypto.randomUUID(),
  p2: crypto.randomUUID(),
  p3: crypto.randomUUID(),
  head: crypto.randomUUID(),
  intro: crypto.randomUUID(),
  photo: crypto.randomUUID(),
  story: crypto.randomUUID(),
  next: crypto.randomUUID(),
};
export const sentence = "The club met on the green at dawn to rig the boats. ";
export const content: Doc = {
  pages: [
    { id: ids.cover, cover: true, blocks: [] },
    {
      id: ids.p2,
      blocks: [
        {
          id: ids.head,
          type: "heading",
          title: "Club news",
          kicker: "",
          level: "main",
        },
        text(ids.intro, ["A short introduction to the month."]),
        {
          id: ids.photo,
          type: "image",
          imageId: photoId,
          align: "full",
          width: 100,
          caption: "",
        },
        text(ids.story, ["The first paragraph.", "The second paragraph."]),
      ],
    },
    {
      id: ids.p3,
      blocks: [
        {
          id: ids.next,
          type: "heading",
          title: "Next month",
          kicker: "",
          level: "section",
        },
      ],
    },
  ],
};

// jsonb stores keys in its own order; compare with keys sorted.
export const canonical = (value: unknown): string =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v).sort(([a], [b]) => a.localeCompare(b)),
        )
      : v,
  );
export const where = (doc: Doc, id: string) =>
  doc.pages.findIndex((p) => p.blocks.some((b) => b.id === id)) + 1;
export const block = (doc: Doc, id: string) =>
  doc.pages.flatMap((p) => p.blocks).find((b) => b.id === id);
export async function until(
  what: string,
  test: () => Promise<boolean>,
  ms = 15_000,
) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await test()) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`FAIL: timed out waiting for ${what}`);
}

/** The chat as the route sees it: every tool output and author message sent. */
export function watchChat(page: Page) {
  const outputs: string[] = [];
  const asked: string[] = [];
  const seen = new Set<string>();
  let requests = 0;
  let runId: string | undefined;
  page.on("request", (req) => {
    if (!req.url().endsWith("/api/admin/ai/chat") || req.method() !== "POST")
      return;
    requests++;
    const body = req.postDataJSON() as {
      runId: string;
      messages: {
        role: string;
        parts: {
          type: string;
          toolCallId?: string;
          text?: string;
          output?: { text: string };
        }[];
      }[];
    };
    runId = body.runId;
    const last = body.messages.at(-1);
    if (last?.role === "user")
      asked.push(
        last.parts
          .map((p) => (p.type === "text" ? (p.text ?? "") : ""))
          .join(""),
      );
    if (last?.role !== "assistant") return;
    for (const part of last.parts)
      if (
        part.type.startsWith("tool-") &&
        part.output &&
        !seen.has(part.toolCallId!)
      ) {
        seen.add(part.toolCallId!);
        outputs.push(part.output.text);
      }
  });
  const LOG = '[role="log"]';
  const busy = (value: "true" | "false", timeout = 60_000) =>
    page.waitForFunction(
      ([sel, v]) =>
        document.querySelector(sel!)?.getAttribute("aria-busy") === v,
      [LOG, value],
      { timeout },
    );
  return {
    outputs,
    asked,
    /** The run id of the latest request. */
    runId: () => runId,
    /** Send a scripted run and wait for it to finish: what it sent back. */
    async runScript(
      calls: { toolName: string; input: object }[],
      prefix = "Please",
    ) {
      const from = outputs.length;
      const sent = requests;
      await page.fill(
        "#assistant-input",
        `${prefix} [fake:tools]${JSON.stringify(calls)}`,
      );
      await page.keyboard.press("Enter");
      await busy("true");
      await busy("false");
      return { outputs: outputs.slice(from), requests: requests - sent };
    },
  };
}
