// The avatar half of dev-asset-lifecycle-gate.mts (issue #300), against a
// running server: replacing a name's photo leaves exactly one image row and
// one object for it, and Remove photo clears both. Uploads go through the real
// route; Remove photo is pressed on /profile. Its member is removed again.
import { access } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { chromium } from "playwright";
import sharp from "sharp";
import { db } from "../src/db";
import { images, memberNames, sessions, users } from "../src/db/schema";

type Made = { images: string[]; keys: string[] };

export async function checkAvatarLifecycle(
  base: string,
  uploads: string,
  made: Made,
  ok: (cond: unknown, msg: string) => void,
) {
  const userId = crypto.randomUUID();
  const token = crypto.randomUUID();
  const email = `check-300-lifecycle-${userId.slice(0, 8)}@example.invalid`;
  await db
    .insert(users)
    .values({ id: userId, email, emailVerified: new Date() });
  await db.insert(sessions).values({
    sessionToken: token,
    userId,
    expires: new Date(Date.now() + 86_400_000),
  });
  const [name] = await db
    .insert(memberNames)
    .values({ userId, name: "Lifecycle Person", nameKey: "lifecycle person" })
    .returning({ id: memberNames.id });
  const nameId = name!.id;
  const cookie = `authjs.session-token=${token}`;

  const photo = (colour: string) =>
    sharp({
      create: { width: 320, height: 240, channels: 3, background: colour },
    })
      .jpeg()
      .toBuffer();
  const upload = async (bytes: Buffer) => {
    const body = new FormData();
    body.set(
      "file",
      new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }),
      "a.jpg",
    );
    const res = await fetch(`${base}/api/profile/avatar?name=${nameId}`, {
      method: "POST",
      body,
      headers: { cookie, origin: new URL(base).origin },
    });
    return res.status;
  };
  // Every avatar the name has held, for the finally to sweep if the app didn't.
  const seen = async () => {
    const [row] = await db
      .select({ id: images.id, key: images.key })
      .from(memberNames)
      .innerJoin(images, eq(images.id, memberNames.avatarImageId))
      .where(eq(memberNames.id, nameId));
    if (row) {
      made.images.push(row.id);
      made.keys.push(row.key);
    }
    return row ?? null;
  };
  const exists = (key: string) =>
    access(path.join(uploads, key)).then(
      () => true,
      () => false,
    );

  try {
    ok((await upload(await photo("#a33"))) === 200, "the first avatar uploads");
    const first = await seen();
    ok((await upload(await photo("#33a"))) === 200, "a replacement uploads");
    const second = await seen();
    const firstRows = await db
      .select()
      .from(images)
      .where(eq(images.id, first!.id));
    ok(
      second && second.id !== first?.id && firstRows.length === 0,
      "the replaced avatar's image row is deleted",
    );
    ok(
      !(await exists(first!.key)) && (await exists(second!.key)),
      "exactly one avatar object is left for the name",
    );

    const browser = await chromium.launch();
    try {
      const ctx = await browser.newContext();
      await ctx.addCookies([
        { name: "authjs.session-token", value: token, url: base },
      ]);
      const page = await ctx.newPage();
      await page.goto(`${base}/profile`);
      await page.click(
        'button[aria-label="Remove photo from Lifecycle Person"]',
      );
      await page.waitForSelector(
        'button[aria-label="Remove photo from Lifecycle Person"]',
        {
          state: "detached",
        },
      );
    } finally {
      await browser.close();
    }
    const secondRows = await db
      .select()
      .from(images)
      .where(eq(images.id, second!.id));
    ok(
      secondRows.length === 0 && !(await exists(second!.key)),
      "Remove photo deletes the image row and its object",
    );
  } finally {
    await db.delete(users).where(eq(users.id, userId));
  }
}
