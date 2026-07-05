// Object storage for the seed script. The app's facade (src/lib/storage.ts and
// the r2/local backends behind it) is `server-only` and reads src/lib/env.ts,
// so it can't be imported outside Next — the seed mirrors it here the same way
// it mirrors image-processing.ts and builds its own Postgres client (seed.ts).
// Behaviour must match the facade: R2 when configured, local disk otherwise,
// same key semantics and cache headers — so seeded rows always point at bytes
// the app can actually serve.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const R2_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_URL",
] as const;

// Where seed objects will land. Mirrors storage.ts (all R2 vars set → R2), but
// unlike the app — which quietly falls back to local disk — a *partial* R2
// config here is an error: on a deploy it would seed image rows whose bytes
// never reach the bucket, which is exactly the broken-demo failure this module
// exists to prevent.
export function seedStorageTarget(): "r2" | "local" {
  const set = R2_KEYS.filter((key) => process.env[key]);
  if (set.length === 0) return "local";
  if (set.length < R2_KEYS.length) {
    const missing = R2_KEYS.filter((key) => !process.env[key]);
    throw new Error(
      `R2 is partially configured — refusing to guess a storage backend. ` +
        `Set the missing var(s) or unset them all: ${missing.join(", ")}`,
    );
  }
  return "r2";
}

let r2Client: S3Client | null = null;

function requireR2(): { client: S3Client; bucket: string } {
  r2Client ??= new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  return { client: r2Client, bucket: process.env.R2_BUCKET! };
}

// Store bytes at `key` through whichever backend the environment selects —
// the same put the app's facade would do (r2.ts putObject / local-storage.ts
// putLocalObject), including the immutable cache header R2 objects carry.
export async function putSeedObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  if (seedStorageTarget() === "r2") {
    const { client, bucket } = requireR2();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    return;
  }
  const dest = path.join(process.cwd(), ".data", "uploads", key);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, body);
}
