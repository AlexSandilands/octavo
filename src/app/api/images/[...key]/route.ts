import { NextResponse } from "next/server";
import { readLocalObject } from "@/lib/local-storage";

// Serves images from the local filesystem backend (dev only). When R2 is
// configured, images come straight from R2's public URL and this route is
// unused — keyToUrl points elsewhere.

const CONTENT_TYPES: Record<string, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  avif: "image/avif",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key } = await params;
  const data = await readLocalObject(key.join("/"));
  if (!data) return new NextResponse("Not found", { status: 404 });

  const ext = key[key.length - 1]?.split(".").pop()?.toLowerCase() ?? "";
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
