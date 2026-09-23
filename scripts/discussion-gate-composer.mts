// dev-discussion-gate.mts, the composer (issue #301): the first post that
// brings its own name — and one refused after making it — a refused name, an
// empty post, the rate limit, and the one-line bottom row under a long name.
import type { Kit } from "./discussion-gate-kit.mts";
import type { Cast } from "./discussion-gate-desktop.mts";
import { heard, post } from "./discussion-gate-desktop.mts";

export async function composerStates(k: Kit, c: Cast) {
  k.heading("composer — a first post brings its own name");
  const bob = await k.member("bob", { name: "Bob Newcomer" });
  let r = await k.reader(bob, c.issue.number!, { query: "?discussion=1" });
  await k.waitThread(r.page);
  const field = r.page.locator("#discussion-composer-name");
  k.ok(
    (await r.page
      .locator("label[for=discussion-composer-name]")
      .textContent()) === "Choose the name other members will see",
    "with no names, the composer asks for one",
  );
  k.ok(
    (await field.inputValue()) === "Bob Newcomer",
    "suggested from users.name",
  );
  const before = await post(r.page, "check-301 my first post");
  k.ok(
    await heard(r.page, "Your comment is posted.", before),
    "the first post goes through",
  );
  const names =
    await k.sql`select id, name from member_names where user_id = ${bob.id}`;
  k.ok(
    names.length === 1 && names[0]!.name === "Bob Newcomer",
    "and creates that name",
  );
  k.ok(
    await r.page
      .locator('article[aria-label="Comment by Bob Newcomer"]')
      .isVisible(),
    "the comment shows under it",
  );
  k.ok(
    (await r.page.locator("text=Posting as").count()) > 0 &&
      (await r.page
        .locator('a:has-text("Add a name")')
        .getAttribute("href")) === "/profile",
    "the composer now reads “Posting as” with an Add a name link",
  );
  await r.ctx.close();

  k.heading("composer — a first post refused after its name was made");
  // The server refuses the comment once the name exists. Stripping the box's
  // maxlength (as a crafted client could) makes that refusal repeatable.
  const second = await k.member("second", { name: "Sam Second" });
  r = await k.reader(second, c.issue.number!, { query: "?discussion=1" });
  await k.waitThread(r.page);
  await r.page.evaluate(() =>
    document
      .querySelector("#discussion-composer")
      ?.removeAttribute("maxlength"),
  );
  const long = "x".repeat(2001);
  await post(r.page, long);
  await r.page.waitForSelector("#discussion-composer-error");
  const refusal =
    (await r.page.textContent("#discussion-composer-error")) ?? "";
  k.ok(
    refusal !== "" && !refusal.includes("Choose one of your names"),
    `the refusal is shown (“${refusal}”)`,
  );
  const made =
    await k.sql`select id from member_names where user_id = ${second.id}`;
  k.ok(made.length === 1, "the name was created");
  await r.page.waitForSelector("#discussion-composer-name", {
    state: "detached",
  });
  k.ok(
    (await r.page.locator("text=Posting as").count()) > 0,
    "the composer moves on to “Posting as” it",
  );
  k.ok(
    (await r.page.inputValue("#discussion-composer")) === long,
    "the draft is still in the box",
  );
  const again = await post(r.page, "check-301 carried on");
  k.ok(
    await heard(r.page, "Your comment is posted.", again),
    "a second submit goes through",
  );
  const [carried] = await k.sql`select author_name_id from comments
    where author_id = ${second.id}`;
  k.ok(
    carried?.author_name_id === made[0]!.id,
    "under the name the first try made",
  );
  await r.ctx.close();

  await longNameRow(k, c);

  k.heading("composer — a refused name, an empty post");
  const newbie = await k.member("newbie");
  r = await k.reader(newbie, c.issue.number!, { query: "?discussion=1" });
  await k.waitThread(r.page);
  await r.page.click("form:has(#discussion-composer) button[type=submit]");
  k.ok(
    (await r.page.locator("#discussion-composer-error").textContent()) ===
      "Write something first.",
    "an empty post is refused inline",
  );
  await r.page.fill("#discussion-composer-name", "Admin");
  await post(r.page, "check-301 should not post");
  await r.page.waitForSelector("#discussion-composer-name-error");
  k.ok(
    (await r.page.textContent("#discussion-composer-name-error")) ===
      "That name is reserved. Choose another.",
    "a refused name shows the validator's reason",
  );
  const [none] =
    await k.sql`select count(*)::int as n from comments where author_id = ${newbie.id}`;
  k.ok(none?.n === 0, "and nothing is posted");
  await r.ctx.close();

  k.heading("composer — the rate limit");
  const fast = await k.member("fast", { name: "Fast Poster" });
  await k.name(fast.id, "Fast Poster");
  r = await k.reader(fast, c.issue.number!, { query: "?discussion=1" });
  await k.waitThread(r.page);
  for (let i = 0; i < 10; i++) {
    await post(r.page, `check-301 quick ${i}`);
    await r.page.waitForFunction(
      () =>
        (document.querySelector("#discussion-composer") as HTMLTextAreaElement)
          ?.value === "",
      undefined,
      { timeout: 15_000 },
    );
  }
  await post(r.page, "check-301 one too many");
  await r.page.waitForSelector("#discussion-composer-error");
  k.ok(
    (await r.page.textContent("#discussion-composer-error")) ===
      "You're posting quickly — try again in a few minutes.",
    "the eleventh post in ten minutes is slowed down, in words",
  );
  await r.ctx.close();
}

// The composer's bottom row stays one line — "Posting as", the name menu and
// the buttons — even under a 40-character name, in a reply box on a phone.
// The main box on a phone gives its two pills (#304) a row above Post.
async function longNameRow(k: Kit, c: Cast) {
  const long = "Bartholomew Alexander Fitzwilliam-Smythe";
  const who = await k.member("longname", { name: "Bart Check" });
  await k.name(who.id, long);
  await k.name(who.id, "B. Smythe");
  for (const width of [1280, 360]) {
    k.heading(`composer — a 40-character name, ${width}px`);
    const r = await k.reader(who, c.issue.number!, {
      width,
      height: 740,
      query: "?discussion=1",
    });
    await k.waitThread(r.page);
    await r.page.click(
      `#comment-${c.adaComment} button[aria-label^="Reply to"]`,
    );
    const replyBox = `#reply-${c.adaComment}`;
    await r.page.waitForSelector(replyBox);
    for (const [form, what] of [
      [`form:has(${replyBox})`, "the reply box"],
      ["form:has(#discussion-composer)", "the main box"],
    ] as const) {
      const row = await r.page.evaluate((sel) => {
        const f = document.querySelector(sel)!;
        const boxes = [
          f.querySelector('button[aria-haspopup="menu"]'),
          ...f.querySelectorAll("button:not([aria-haspopup])"),
        ]
          .filter((b): b is Element => b !== null && !b.closest("[role=menu]"))
          .map((b) => b.getBoundingClientRect());
        const trigger = f.querySelector(
          'button[aria-haspopup="menu"] .truncate',
        );
        const panel = f.closest("[role=dialog]")!.getBoundingClientRect();
        return {
          mids: boxes.map((b) => Math.round(b.top + b.height / 2)),
          inside: boxes.every(
            (b) => b.left >= panel.left && b.right <= panel.right,
          ),
          truncated: trigger
            ? trigger.scrollWidth > trigger.clientWidth
            : false,
          heights: boxes.map((b) => Math.round(b.height)),
        };
      }, form);
      // A phone's main box puts its two pills (#304) on a row above Post.
      const stacked = what === "the main box" && width < 768;
      k.ok(
        row.mids.length >= 2 &&
          row.inside &&
          (stacked
            ? Math.min(...row.mids.slice(1)) - row.mids[0]! >= 30
            : Math.max(...row.mids) - Math.min(...row.mids) <= 2),
        `${what}: ${stacked ? "the pills on a row of their own, Post beneath" : "name menu and buttons on one line"}, inside the panel (${row.mids.join(", ")})`,
      );
      k.ok(
        row.truncated,
        `${what}: the long name is cut short with an ellipsis`,
      );
    }
    const hit = await r.page.evaluate((sel) => {
      const b = document.querySelector(`form:has(${sel}) button[type=submit]`)!;
      b.scrollIntoView({ block: "center" });
      const r = b.getBoundingClientRect();
      const x = r.left + r.width / 2;
      return [r.top - 3, r.bottom + 3].every(
        (y) => document.elementFromPoint(x, y)?.closest("button") === b,
      );
    }, replyBox);
    k.ok(
      hit,
      "the Reply button answers a press 3px past its edges (a 44px target)",
    );
    if (width < 768) await k.shot(r.page, "phone-360-reply-long-name");
    await r.ctx.close();
  }
}
