// The magazine's default text size (#25) as the assistant's tools see it, in
// memory: insert_blocks starts text at it, an explicit size wins, set_text keeps
// or changes a block's size, and M is never stored.
import type { Block } from "../../../src/lib/blocks";
import { aiToolSchemas } from "../../../src/lib/ai-tools";
import * as h from "./tools-harness.mts";

const { ok, heading, harness, textBlock, cover, page } = h;

export async function defaultSizeChecks() {
  heading("the magazine's default text size (#25)");
  {
    const sizeOf = (b: Block | undefined) =>
      (b as { size?: string } | undefined)?.size;
    const insert = (size?: string) => ({
      after: { page: 2 },
      blocks: [{ kind: "text", markdown: "New.", ...(size ? { size } : {}) }],
    });
    for (const [dflt, want] of [
      [undefined, undefined],
      ["m", undefined],
      ["l", "l"],
    ] as const) {
      const t = harness([cover, page(textBlock(1))], dflt);
      await t.run("insert_blocks", insert());
      ok(
        sizeOf(t.pages[1]!.blocks[0]) === want,
        `insert_blocks starts text at ${want ?? "no stored size"} under default ${dflt ?? "unset"}`,
      );
    }
    const t = harness([cover, page(textBlock(1))], "l");
    await t.run("insert_blocks", insert("s"));
    ok(
      sizeOf(t.pages[1]!.blocks[0]) === "s",
      "an explicit size beats the default",
    );
    const id = t.pages[1]!.blocks[1]!.id;
    const typed = await t.run("set_text", { blockId: id, markdown: "Kept." });
    ok(
      !typed.text.startsWith("Error") &&
        sizeOf(t.pages[1]!.blocks[1]) === undefined,
      "set_text without a size leaves the block's size alone (no default applied to old text)",
    );
    await t.run("set_text", { blockId: id, markdown: "Bigger.", size: "xl" });
    ok(sizeOf(t.pages[1]!.blocks[1]) === "xl", "set_text with a size sets it");
    await t.run("set_text", { blockId: id, markdown: "Back.", size: "m" });
    ok(
      !("size" in t.pages[1]!.blocks[1]!),
      "set_text with size m removes the stored size",
    );
    ok(
      !aiToolSchemas.set_text.safeParse({
        blockId: id,
        markdown: "x",
        size: "huge",
      }).success,
      "an unknown size is refused by zod",
    );
  }
}
