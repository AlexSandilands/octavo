// dev-assistant-tools-gate.mts's long-paste half (#312), kept apart for the
// 500-line rule: a 6,000-character
// message asks first with an estimate, Cancel sends nothing (no request, no
// ledger row) and keeps the text, Continue sends; a scripted propose_sections
// of 8 sections lands each from the top of a fresh page, headline / kicker /
// standfirst where the plan put them, with no overflow marker on any page;
// one Ctrl+Z takes it all back.
import type { Page } from "playwright";
import type postgres from "postgres";
import {
  canonical,
  ids,
  until,
  type Doc,
  type watchChat,
} from "./fixtures/assistant/tools-gate-kit.mts";

const INPUT = "#assistant-input";
const CONFIRM = "[data-assistant-paste-confirm]";
const MARKER = "[data-editor-canvas-stage] .border-dashed.border-warn";
const sentence =
  "Members gathered at the clubhouse to hear the season's plans. ";

type Kit = {
  page: Page;
  chat: ReturnType<typeof watchChat>;
  sql: postgres.Sql;
  adminId: string;
  saved: () => Promise<Doc>;
  ok: (cond: unknown, msg: string) => void;
  heading: (name: string) => void;
};

const body = (n: number, label: string) =>
  Array.from(
    { length: n },
    (_, i) => `${label} paragraph ${i + 1}. ${sentence.repeat(3)}`,
  ).join("\n\n");

export async function planChecks({
  page,
  chat,
  sql,
  adminId,
  saved,
  ok,
  heading,
}: Kit) {
  heading("a long paste asks first; Cancel sends nothing");
  const before = await saved();
  const from = before.pages.length;
  const sections = Array.from({ length: 8 }, (_, i) => ({
    headline: `SECTION ${i + 1} HEADLINE`,
    ...(i === 0 ? { kicker: "Club Notes" } : {}),
    standfirst: `Standfirst for section ${i + 1}.`,
    // Section 4 runs past a page: the paginator adds one.
    body: body(i === 3 ? 24 : 3, `S${i + 1}`),
    ...(i === 1 ? { photos: [{ after: 1 }] } : {}),
  }));
  const message = `Lay these out as new pages [fake:tools]${JSON.stringify([
    { toolName: "propose_sections", input: { after: from, sections } },
  ])}`;
  ok(message.length >= 6_000, `the paste is ${message.length} characters`);

  const rows = async () =>
    Number(
      (
        await sql<{ n: string }[]>`select count(*) as n from ai_usage
          where user_id = ${adminId}`
      )[0]!.n,
    );
  // An inside page, where the presets would otherwise be on.
  await page.click('button[aria-label="Page 2"]');
  const ledger = await rows();
  const asked = chat.asked.length;
  await page.fill(INPUT, message);
  await page.keyboard.press("Enter");
  await page.waitForSelector(CONFIRM);
  ok(
    (await page
      .locator('button:text-is("Tidy this page")')
      .getAttribute("aria-disabled")) === "true",
    "while it asks, the presets are off",
  );
  const copy = (await page.textContent(CONFIRM)) ?? "";
  ok(
    /cost more than a normal request \(about US\$\d+\.\d\d on the current model\)/.test(
      copy,
    ) && copy.includes("Continue?"),
    `the question, with an estimate: "${copy.match(/about US\$[\d.]+/)?.[0]}"`,
  );
  await page.click(`${CONFIRM} button:text-is("Cancel")`);
  await page.waitForTimeout(1_500);
  ok(
    !(await page.$(CONFIRM)) &&
      chat.asked.length === asked &&
      (await rows()) === ledger &&
      (await page.inputValue(INPUT)) === message,
    "Cancel: no request, no ledger row, and the text is still in the box",
  );

  heading("Continue sends; propose_sections places 8 sections");
  await page.keyboard.press("Enter");
  await page.waitForSelector(CONFIRM);
  const run = await chat.awaitRun(() =>
    page.click(`${CONFIRM} button:text-is("Continue")`),
  );
  ok(
    chat.asked[asked]?.startsWith("Lay these out") &&
      (await page.inputValue(INPUT)) === "" &&
      run.outputs[0]?.startsWith("Placed 8 sections"),
    `Continue sent it: ${run.outputs[0]?.slice(0, 160)}…`,
  );
  const isTop = (p: Doc["pages"][number]) =>
    /^SECTION \d HEADLINE$/.test(String(p.blocks[0]?.title ?? ""));
  await until("autosave of the plan", async () =>
    (await saved()).pages.some(
      (p) => p.blocks[0]?.title === "SECTION 8 HEADLINE",
    ),
  );
  const doc = await saved();
  // An empty last page takes the first section.
  const first = doc.pages.findIndex(isTop);
  const added = doc.pages.slice(first);
  const tops = added.filter(isTop);
  ok(
    first >= from - 1 &&
      tops.length === 8 &&
      tops.every(
        (p, i) =>
          p.blocks[0]!.title === `SECTION ${i + 1} HEADLINE` &&
          p.blocks[0]!.level === "main",
      ),
    `each section starts a fresh page (pages ${first + 1}–${doc.pages.length})`,
  );
  const [one, two] = tops;
  const plain = (b: unknown) => JSON.stringify(b);
  ok(
    one!.blocks[0]!.kicker === "Club Notes" &&
      two!.blocks[0]!.kicker === "" &&
      tops.every(
        (p, i) =>
          p.blocks[1]?.type === "text" &&
          plain(p.blocks[1]).includes(`Standfirst for section ${i + 1}.`),
      ),
    "headline, kicker and standfirst where the plan put them",
  );
  ok(
    added.length === 9 &&
      !isTop(added[4]!) &&
      !run.outputs[0]!.includes("overflows"),
    "section 4 took a continuation page; every page reported as fitting",
  );
  for (let i = first + 1; i <= doc.pages.length; i++) {
    await page.click(`button[aria-label="Page ${i}"]`);
    await page.waitForTimeout(400);
    ok(!(await page.$(MARKER)), `page ${i}: no overflow marker`);
  }
  const line = (await page.textContent("[data-assistant-run]")) ?? "";
  ok(
    line.includes('Suggested a photo for "SECTION 2 HEADLINE".'),
    `the run's line carries the suggestion: "${line}"`,
  );

  heading("one Ctrl+Z takes the plan back");
  await page.click("body", { position: { x: 5, y: 5 } }).catch(() => {});
  await page.evaluate(() =>
    (document.activeElement as HTMLElement | null)?.blur(),
  );
  await page.keyboard.press("Control+z");
  await until(
    "autosave of the undo",
    async () => (await saved()).pages.length === from,
  );
  ok(
    canonical((await saved()).pages) === canonical(before.pages),
    "the issue is back to its pages before the plan",
  );

  heading("Stop, then a new message: the stopped plan lands nowhere");
  const late = Array.from({ length: 20 }, (_, i) => ({
    headline: `LATE ${i + 1}`,
    body: body(4, `L${i + 1}`),
  }));
  await page.fill(
    INPUT,
    `Lay these out [fake:slow] [fake:tools]${JSON.stringify([
      { toolName: "propose_sections", input: { after: from, sections: late } },
    ])}`,
  );
  await page.keyboard.press("Enter");
  await page.click(`${CONFIRM} button:text-is("Continue")`);
  // A placement runs in about a second with the page busy measuring, so a
  // click can't land inside one (check-ai-plan stops one mid-way). Here the
  // slowed stream is stopped before its call arrives; nothing may follow.
  await page.waitForSelector('[role="log"][aria-busy="true"]');
  await page.click('button[aria-label="Stop the reply"]');
  await page.waitForSelector('[role="log"][aria-busy="false"]');
  const next = await chat.runScript([
    {
      toolName: "set_text",
      input: { blockId: ids.intro, markdown: "AFTER STOP" },
    },
  ]);
  await page.waitForTimeout(3_000);
  const after = await saved();
  ok(
    next.outputs[0]?.startsWith("Updated the text") &&
      after.pages.length === from &&
      !JSON.stringify(after).includes("LATE 1"),
    `the stopped plan placed nothing; the next run's edit landed (${next.outputs[0]?.slice(0, 60)}; ${after.pages.length} pages, ${from} before; late: ${JSON.stringify(after).includes("LATE 1")})`,
  );
  await page.click('[data-assistant-run] button:text-is("Undo")');
  await until(
    "autosave of the next run's Undo",
    async () => canonical((await saved()).pages) === canonical(before.pages),
  );
  ok(true, "the next run's Undo takes back only its own edit");
}
