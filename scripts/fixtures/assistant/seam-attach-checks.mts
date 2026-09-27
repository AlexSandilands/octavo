// The one send seam (#312) with photos attached (#343), for
// dev-assistant-attach-gate.mts: a long message with two photos asks first;
// while it asks the tray is locked (remove off, a drop and a pasted photo
// refused, nothing uploaded); Continue sends the words and both ids in one
// message, once, and only then do the box and the tray empty.
import type { Page } from "playwright";
import { CONFIRM_FROM_CHARS } from "../../../src/features/editor/assistant/paste-estimate";
import type { watchChat } from "./tools-gate-kit.mts";

const INPUT = "#assistant-input";
const CONFIRM = "[data-assistant-paste-confirm]";
const THUMB = "[data-attachment]";
const PICKER = "input[data-attach-input]";

type File = { name: string; mimeType: string; buffer: Buffer };

export async function attachSeamChecks(
  page: Page,
  d: {
    chat: ReturnType<typeof watchChat>;
    /** Two photos to attach, and one to try while the question is up. */
    photos: [File, File, File];
    settled: (n: number) => Promise<unknown>;
    ok: (cond: unknown, msg: string) => void;
    heading: (name: string) => void;
  },
) {
  const { chat, ok } = d;
  d.heading("a long message with photos asks; Continue sends the ids once");
  await page.setInputFiles(PICKER, [d.photos[0], d.photos[1]]);
  await d.settled(2);
  const ids = await page.$$eval(THUMB, (els) =>
    els.map((el) => el.getAttribute("data-attachment")!),
  );
  const words = `Lay out these notes. ${"The fleet sailed at dawn. ".repeat(180)}[fake:echo]`;
  ok(words.length > CONFIRM_FROM_CHARS, `the message is ${words.length} chars`);
  const asked = chat.asked.length;
  let uploads = 0;
  const count = (req: { url(): string }) => {
    if (req.url().endsWith("/api/admin/images")) uploads++;
  };
  page.on("request", count);
  try {
    await page.fill(INPUT, words);
    await page.keyboard.press("Enter");
    await page.waitForSelector(CONFIRM);
    ok(
      await page.$$eval(`${THUMB} button`, (els) =>
        els.every((el) => (el as HTMLButtonElement).disabled),
      ),
      "while it asks, the thumbnails' remove buttons are off",
    );
    const b64 = d.photos[2].buffer.toString("base64");
    // No named helpers inside: tsx would wrap them in a __name the page lacks.
    await page.evaluate((data) => {
      const bin = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      const panel = document.querySelector("[data-assistant-panel]")!;
      const input = document.querySelector("#assistant-input")!;
      for (const type of ["dragover", "drop", "paste"]) {
        const t = new DataTransfer();
        t.items.add(new File([bin], "late.png", { type: "image/png" }));
        if (type === "paste")
          input.dispatchEvent(
            new ClipboardEvent(type, { clipboardData: t, bubbles: true }),
          );
        else
          panel.dispatchEvent(
            new DragEvent(type, {
              dataTransfer: t,
              bubbles: true,
              cancelable: true,
            }),
          );
      }
    }, b64);
    await page.waitForTimeout(800);
    ok(
      (await page.$$(THUMB)).length === 2 &&
        uploads === 0 &&
        chat.asked.length === asked,
      "a dropped and a pasted photo are refused; nothing uploaded or sent",
    );

    await chat.awaitRun(() =>
      page.click(`${CONFIRM} button:text-is("Continue")`),
    );
    const line = `Attached 2 photos: ${ids.join(", ")}`;
    const carrying = chat.asked.slice(asked).filter((m) => m.includes(line));
    ok(
      chat.asked.length === asked + 1 &&
        carrying.length === 1 &&
        carrying[0]!.startsWith("Lay out these notes."),
      "Continue sent one message, with the words and both ids",
    );
    ok(
      (await page.$$(THUMB)).length === 0 &&
        (await page.inputValue(INPUT)) === "",
      "and only then did the box and the tray empty",
    );
  } finally {
    page.off("request", count);
  }
}
