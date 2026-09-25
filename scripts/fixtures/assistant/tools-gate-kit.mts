// The scratch issue and small helpers for dev-assistant-tools-gate.mts (#310):
// a cover, a page with a heading, an intro, a photo and a story, and a page
// after it; lookups over a saved document; and a poll with a deadline.

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
