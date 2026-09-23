// The avatar half of dev-profile-gate.mts (issue #300): the upload route's
// every refusal and its rate limit, then Change photo / Remove photo through
// the page, checking rows and objects as it goes.
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { Member, ProfileKit } from "./profile-gate-kit.mts";

// ── Images the upload tests post ────────────────────────────────────────────
async function noiseJpeg(target: number): Promise<Buffer> {
  for (let edge = 1100; ; edge += 25) {
    const raw = Buffer.alloc(edge * edge * 3);
    for (let i = 0; i < raw.length; i++) raw[i] = (Math.random() * 256) | 0;
    const jpeg = await sharp(raw, {
      raw: { width: edge, height: edge, channels: 3 },
    })
      .jpeg({ quality: 100 })
      .toBuffer();
    if (jpeg.length >= target) return jpeg;
  }
}
const pdf = Buffer.from(
  "%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n",
);

/** Posts a file to the avatar route as a member (or nobody), from an origin. */
export function uploader(base: string) {
  const origin = new URL(base).origin;
  return async function upload(
    m: Member | null,
    nameId: string,
    bytes: Buffer,
    opts: { type?: string; filename?: string; origin?: string | null } = {},
  ) {
    const body = new FormData();
    body.set(
      "file",
      new Blob([new Uint8Array(bytes)], { type: opts.type ?? "image/jpeg" }),
      opts.filename ?? "photo.jpg",
    );
    const headers: Record<string, string> = {};
    if (m) headers.cookie = `authjs.session-token=${m.token}`;
    if (opts.origin !== null) headers.origin = opts.origin ?? origin;
    const res = await fetch(`${base}/api/profile/avatar?name=${nameId}`, {
      method: "POST",
      body,
      headers,
    });
    const json = (await res.json().catch(() => ({}))) as { reason?: string };
    return { status: res.status, reason: json.reason ?? "" };
  };
}

const uploads = path.join(process.cwd(), ".data", "uploads");
const stored = (key: string) =>
  readFile(path.join(uploads, key)).catch(() => null);

export async function avatarsGate(kit: ProfileKit, foreignNameId: string) {
  const { base, sql, ok, heading, member, nameRow, upload, smallJpeg, out } =
    kit;
  const heard = kit.heard;
  const avatarOf = async (nameId: string) => {
    const [row] = await sql<
      { id: string; key: string; w: number; h: number }[]
    >`select i.id, i.key, i.width as w, i.height as h
      from member_names n join images i on i.id = n.avatar_image_id
      where n.id = ${nameId}`;
    return row ?? null;
  };
  const countOf = async (id: string) => {
    const [row] = await sql<{ n: number }[]>`
      select count(*)::int as n from images where id = ${id}`;
    return row?.n ?? 0;
  };

  heading("avatars");
  const p = await member("photo", { name: "Photo Person" });
  const pName = await nameRow(p.id, "Photo Person");
  const big = await noiseJpeg(4 * 1024 * 1024);
  console.log(`  (a ${(big.length / 1048576).toFixed(2)} MB JPEG)`);
  const first = await upload(p, pName, big);
  ok(
    first.status === 200,
    `a 4 MB JPEG uploads (${first.status} ${first.reason})`,
  );
  const av = await avatarOf(pName);
  const bytes = av ? await stored(av.key) : null;
  const meta = bytes ? await sharp(bytes).metadata() : null;
  ok(
    av?.w === 256 &&
      av?.h === 256 &&
      meta?.format === "webp" &&
      meta.width === 256,
    `stored as a 256px square WebP (${av?.w}×${av?.h} ${meta?.format})`,
  );
  const home = await (
    await fetch(`${base}/`, {
      headers: { cookie: `authjs.session-token=${p.token}` },
    })
  ).text();
  ok(
    av != null && home.includes(av.key.split("/").pop()!),
    "the header shows the default name's photo",
  );
  const six = Buffer.concat([big, Buffer.alloc(6 * 1024 * 1024 - big.length)]);
  const tooBig = await upload(p, pName, six);
  ok(
    tooBig.status === 413 && tooBig.reason.includes("under 5 MB"),
    `a 6 MB file is refused: “${tooBig.reason}”`,
  );
  const notImage = await upload(p, pName, pdf, {
    type: "image/jpeg",
    filename: "sneaky.jpg",
  });
  ok(
    notImage.status === 415 && notImage.reason.includes("isn't a photo"),
    `a PDF (declared a JPEG) is refused: “${notImage.reason}”`,
  );
  const foreign = await upload(p, foreignNameId, smallJpeg);
  const unknown = await upload(p, crypto.randomUUID(), smallJpeg);
  ok(
    foreign.status === 400 && foreign.reason === unknown.reason,
    "another account's name id is refused, the same answer as an unknown id",
  );
  const anon = await upload(null, pName, smallJpeg);
  ok(anon.status === 401, `a signed-out POST is refused (${anon.status})`);
  const cross = await upload(p, pName, smallJpeg, {
    origin: "https://evil.example",
  });
  const noOrigin = await upload(p, pName, smallJpeg, { origin: null });
  ok(
    cross.status === 403 && noOrigin.status === 403,
    `a cross-origin POST and one with no Origin are refused (${cross.status}, ${noOrigin.status})`,
  );

  const limit = await member("limit");
  const limitName = await nameRow(limit.id, "Busy Bee");
  const statuses: number[] = [];
  for (let i = 0; i < 6; i++) {
    statuses.push((await upload(limit, limitName, smallJpeg)).status);
  }
  const sixthUpload = await upload(limit, limitName, smallJpeg);
  ok(
    statuses.slice(0, 5).every((s) => s === 200) && statuses[5] === 429,
    `five uploads in an hour, the sixth refused (${statuses.join(",")})`,
  );
  ok(
    sixthUpload.reason.includes("going a little fast"),
    "with the slow-down sentence",
  );
  const [limitRow] = await sql<{ n: number }[]>`
    select count(*)::int as n from images i join member_names n on n.avatar_image_id = i.id
    where n.user_id = ${limit.id}`;
  const limitRows = limitRow?.n;
  ok(
    limitRows === 1,
    `after five replacements the name holds one image (${limitRows})`,
  );

  heading("avatars — through the page");
  const page = await kit.open(p, 390);
  const chooser = page.waitForEvent("filechooser");
  await page.click('button[aria-label="Change photo for Photo Person"]');
  await (
    await chooser
  ).setFiles({
    name: "me.jpg",
    mimeType: "image/jpeg",
    buffer: smallJpeg,
  });
  ok(
    await heard(page, "Photo updated for “Photo Person”."),
    "Change photo uploads and announces",
  );
  await page.waitForSelector(
    'button[aria-label="Remove photo from Photo Person"]',
  );
  const replaced = await avatarOf(pName);
  ok(replaced && replaced.id !== av?.id, "the new photo replaced the old");
  ok(av != null && (await stored(av.key)) === null, "the old object is gone");
  const oldRow = await countOf(av?.id ?? "");
  ok(oldRow === 0, "the old image row is gone");
  await page.screenshot({ path: `${out}/profile-phone.png`, fullPage: true });
  await page.click('button[aria-label="Remove photo from Photo Person"]');
  ok(await heard(page, "Photo removed"), "Remove photo is announced");
  ok((await avatarOf(pName)) === null, "Remove photo clears the name's image");
  const leftRow = await countOf(replaced?.id ?? "");
  ok(
    leftRow === 0 && replaced != null && (await stored(replaced.key)) === null,
    "and removes its row and object",
  );

  return { p, pName };
}
