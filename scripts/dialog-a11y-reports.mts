// The reports inbox's three confirmations (issue #302) under the shared dialog
// contract, for dev-dialog-a11y-gate.mts: Delete comment, Clear avatar and
// Retire name, each opened, lapped and closed by Escape and by the backdrop
// without confirming. Its own check-302 rows, removed before it returns.
import type { Page } from "playwright";
import type postgres from "postgres";
import { reportsFixtures } from "./fixtures/reports-fixtures.mts";

type Deps = {
  page: Page;
  sql: postgres.Sql;
  base: string;
  heading: (name: string) => void;
  checkOpenDialog: (page: Page, name: string) => Promise<void>;
  checkEscapeRestores: (page: Page, trigger: string) => Promise<void>;
  checkBackdropRestores: (page: Page, trigger: string) => Promise<void>;
};

export async function checkReportsDialogs(d: Deps) {
  const f = reportsFixtures(d.sql, "dialogs");
  try {
    const issueId = await f.issue();
    const author = await f.user(`${f.stamp} Author`);
    const reporter = await f.user(`${f.stamp} Reporter`);
    const avatar = await f.avatar({ stored: false });
    const nameId = await f.name(author.id, "Dana Dee", avatar.id);
    const comment = await f.comment(issueId, author, nameId, "Dialog words");
    await f.report(comment, reporter.id);
    await d.page.goto(
      `${d.base}/admin/reports?q=${encodeURIComponent(f.stamp)}`,
    );
    await d.page.waitForSelector("h1:has-text('Reports')");

    for (const [trigger, title] of [
      ["Delete comment by Dana Dee", "Delete this comment?"],
      ["Clear avatar for Dana Dee", "Clear the picture for “Dana Dee”?"],
      ["Retire name Dana Dee", "Retire the name “Dana Dee”?"],
    ] as const) {
      d.heading(`ConfirmDialog — reports inbox, ${trigger.split(" by ")[0]}`);
      const open = () =>
        d.page.getByRole("button", { name: trigger, exact: true }).click();
      await open();
      await d.page.waitForSelector("[role=dialog]");
      await d.checkOpenDialog(d.page, title);
      await d.checkEscapeRestores(d.page, trigger);
      await open();
      await d.page.waitForSelector("[role=dialog]");
      await d.checkBackdropRestores(d.page, trigger);
    }
  } finally {
    await f.cleanup();
  }
}
