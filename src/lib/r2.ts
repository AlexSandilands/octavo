import "server-only";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { env } from "./env";

// Cloudflare R2 access (S3-compatible). Server-only: the client holds secret
// credentials and must never reach the browser. Uploads flow through our own
// pipeline (validate → re-encode → store); the client only ever sees the public
// URL of a finished object (design-principles §9).

type R2Config = {
  client: S3Client;
  bucket: string;
  publicUrl: string;
};

let cached: R2Config | null = null;

// True when every R2 var is set. Callers that resolve images use this to fall
// back to placeholders instead of throwing when R2 isn't configured yet (dev).
export function isR2Configured(): boolean {
  return Boolean(
    env.R2_ACCOUNT_ID &&
    env.R2_ACCESS_KEY_ID &&
    env.R2_SECRET_ACCESS_KEY &&
    env.R2_BUCKET &&
    env.R2_PUBLIC_URL,
  );
}

// The configured client, or throws if R2 isn't set up. Image upload/serve paths
// call this; the rest of the app stays usable without R2 configured.
function requireR2(): R2Config {
  if (cached) return cached;
  if (!isR2Configured()) {
    throw new Error(
      "R2 is not configured — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, " +
        "R2_SECRET_ACCESS_KEY, R2_BUCKET and R2_PUBLIC_URL.",
    );
  }
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    },
  });
  cached = {
    client,
    bucket: env.R2_BUCKET!,
    publicUrl: env.R2_PUBLIC_URL!.replace(/\/$/, ""),
  };
  return cached;
}

// Public URL for a stored object key.
export function keyToUrl(key: string): string {
  return `${requireR2().publicUrl}/${key}`;
}

// Store bytes at `key`. Caller owns the key scheme and content type. Objects are
// content-addressed (immutable keys), so they cache forever.
export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
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
}

export async function deleteObject(key: string): Promise<void> {
  const { client, bucket } = requireR2();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
