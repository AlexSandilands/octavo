// dev-discussion-gate.mts, the counts (issue #301): "N comments" on the
// library's cards (visible comments and replies only), and the comments the
// admin's delete confirmations say go with an issue — single and bulk, and
// the library still right after a bulk delete.
import type { Issue, Kit, Member } from "./discussion-gate-kit.mts";
import { fetchHtml } from "./discussion-gate-states.mts";

async function visible(k: Kit, issueId: string) {
  const [row] = await k.sql<
    { n: number }[]
  >`select count(*)::int as n from comments
    where issue_id = ${issueId} and hidden_at is null and deleted_at is null`;
  return row!.n;
}

async function existing(k: Kit, issueIds: string[]) {
  const [row] = await k.sql<
    { n: number }[]
  >`select count(*)::int as n from comments
    where issue_id = any(${issueIds}) and deleted_at is null`;
  return row!.n;
}

const label = (n: number) => `${n} ${n === 1 ? "comment" : "comments"}`;

// The text of the card (or hero) that links to an issue, as rendered — the
// HTML alone won't do: a production build streams part of a card in later.
async function cardText(k: Kit, who: Member, path: string, number: number) {
  const ctx = await k.context(who);
  const page = await ctx.newPage();
  await page.goto(`${k.base}${path}`);
  await page.waitForSelector("footer");
  const texts = await page
    .locator(`a[href="/read/${number}"]`)
    .evaluateAll((els) => els.map((el) => (el as HTMLElement).innerText));
  await ctx.close();
  return texts.join(" | ").replace(/\s+/g, " ");
}

export async function countsGate(
  k: Kit,
  o: {
    reader: Member;
    admin: Member;
    p: Issue;
    q: Issue;
    r: Issue;
    empty: Issue;
  },
) {
  k.heading("counts — the library cards");
  const pCount = await visible(k, o.p.id);
  const archive = `/archive?q=${encodeURIComponent(k.stamp)}`;
  const pCard = await cardText(k, o.reader, archive, o.p.number!);
  k.ok(
    pCard.includes(label(pCount)),
    `the archive card reads “${label(pCount)}” (${pCard.trim().slice(0, 80)})`,
  );
  const qCount = await visible(k, o.q.id);
  const [hiddenQ] = await k.sql`select count(*)::int as n from comments
    where issue_id = ${o.q.id} and hidden_at is not null`;
  k.ok(hiddenQ!.n > 0, "(one of the next issue's comments is hidden)");
  const qCard = await cardText(k, o.reader, archive, o.q.number!);
  k.ok(
    qCard.includes(label(qCount)),
    `hidden comments aren't counted (“${label(qCount)}”)`,
  );
  const emptyCard = await cardText(k, o.reader, archive, o.empty.number!);
  k.ok(
    emptyCard !== "" && !/comment/.test(emptyCard),
    "no line at all on an issue with none",
  );
  const home = await fetchHtml(k, o.reader, "/");
  const latest = await visible(k, o.r.id);
  k.ok(
    home.includes(`· ${label(latest)}`),
    `the latest issue's line carries its count (${label(latest)})`,
  );

  k.heading("counts — the delete confirmations");
  const ctx = await k.context(o.admin);
  const page = await ctx.newPage();
  await page.goto(`${k.base}/admin?q=${encodeURIComponent(k.stamp)}`);
  await page.waitForSelector("h1:has-text('Issues')");
  const [pTitle] = await k.sql`select title from issues where id = ${o.p.id}`;
  await page.click(`button[aria-label="Delete ${pTitle!.title}"]`);
  await page.waitForSelector("[role=dialog]");
  const single = await existing(k, [o.p.id]);
  const text = (await page.textContent("[role=dialog]")) ?? "";
  k.ok(
    text.includes(`Its discussion goes with it: ${label(single)}.`),
    `the single delete names its ${label(single)}`,
  );
  await page.keyboard.press("Escape");
  await page.waitForSelector("[role=dialog]", { state: "detached" });

  const [qTitle] = await k.sql`select title from issues where id = ${o.q.id}`;
  const [rTitle] = await k.sql`select title from issues where id = ${o.r.id}`;
  await page.check(`input[aria-label="Select ${qTitle!.title}"]`);
  await page.check(`input[aria-label="Select ${rTitle!.title}"]`);
  await page.click("button:has-text('Delete selected')");
  await page.waitForSelector("[role=dialog]");
  const bulk = await existing(k, [o.q.id, o.r.id]);
  const bulkText = (await page.textContent("[role=dialog]")) ?? "";
  k.ok(
    bulkText.includes(`Their discussions go with them: ${label(bulk)}.`),
    `the bulk delete names their ${label(bulk)}, hidden ones included`,
  );
  await page.click("[role=dialog] button:has-text('Delete 2')");
  await page.waitForSelector("text=2 issues deleted", { timeout: 20_000 });
  const [gone] = await k.sql`select count(*)::int as n from comments
    where issue_id = any(${[o.q.id, o.r.id]})`;
  k.ok(gone!.n === 0, "the bulk delete took their threads with them");
  await ctx.close();

  const after = await cardText(k, o.reader, archive, o.p.number!);
  k.ok(
    after.includes(label(await visible(k, o.p.id))),
    "the remaining issue's card is still right",
  );
  const res = await fetch(`${k.base}/api/issues/${o.q.number}/comments`, {
    headers: { cookie: `authjs.session-token=${o.reader.token}` },
  });
  k.ok(res.status === 404, `a deleted issue's thread is gone (${res.status})`);
}
