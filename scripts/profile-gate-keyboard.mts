// The profile gate's screenshots and keyboard-only pass (issue #300), plus the
// panel helpers the other halves use.
import { writeFile } from "node:fs/promises";
import type { Page } from "playwright";
import type { Member, ProfileKit } from "./profile-gate-kit.mts";

// Opens one name's panel (a no-op while it is open already).
export async function edit(page: Page, name: string) {
  const button = page.locator(`button[aria-label="Edit ${name}"]`);
  if (await button.count()) await button.click();
}
export const focusLabel = (page: Page) =>
  page.evaluate(() => document.activeElement?.getAttribute("aria-label"));

export async function keyboardGate(
  kit: ProfileKit,
  { named, single }: { named: Member; single: Member },
) {
  const { ok, heading, out } = kit;
  for (const width of [1280, 390]) {
    const shot = await kit.open(named, width);
    await shot.screenshot({
      path: `${out}/names-${width}-collapsed.png`,
      fullPage: true,
    });
    await edit(shot, "Shared Name");
    await shot.screenshot({
      path: `${out}/names-${width}-open.png`,
      fullPage: true,
    });
    await shot.context().close();
  }

  heading("keyboard");
  const page = await kit.open(single);
  // Forward through the page until focus leaves <main> (Next's dev overlay
  // and the document follow it). A field is measured by its decorated box.
  const stops: { name: string; height: number }[] = [];
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || !el.closest("main")) return null;
      const target = el.closest(".boxed-field") ?? el;
      const name =
        el.getAttribute("aria-label") ??
        (el.id
          ? document.querySelector(`label[for="${el.id}"]`)?.textContent
          : null) ??
        el.textContent?.trim() ??
        "";
      return {
        name: `${el.tagName.toLowerCase()}[${name.slice(0, 32)}]`,
        height: Math.round(target.getBoundingClientRect().height),
      };
    });
    if (!stop) break;
    stops.push(stop);
  }
  console.log(
    `  tab order: ${stops.map((s) => `${s.name} ${s.height}px`).join(" → ")}`,
  );
  const small = stops.filter((s) => s.height < 44);
  ok(
    stops[0]?.name.startsWith("button[Edit ") &&
      stops.at(-1)?.name.includes("Back to the library") &&
      small.length === 0,
    `Edit leads, the walk reaches the back link, every stop at least 44px (${small.map((s) => s.name).join(", ") || "all"})`,
  );
  await writeFile(
    `${out}/profile-member.aria.txt`,
    await page.locator("main").ariaSnapshot(),
  );
  await page.screenshot({ path: `${out}/profile-member.png`, fullPage: true });
}
