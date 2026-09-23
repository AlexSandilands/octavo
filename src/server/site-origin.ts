import "server-only";
import { headers } from "next/headers";

// The origin a request arrived on, from its proxy headers. Only for links sent
// back to the person who made the request (the publish blast is the admin's
// own); a link other people will click comes from emailLinkOrigin below.
export function originFromHeaders(h: Headers): string {
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

// Where a link in an email one member's request sends to someone else points
// (the report email to admins, #302; the reply email, #303). The request's
// Host header is never trusted for that: APP_URL, or — in production without
// it — null, and no email. Outside production the request host (or
// localhost) stands in.
export async function emailLinkOrigin(
  appUrl: string | undefined,
  production: boolean,
): Promise<string | null> {
  if (appUrl) return appUrl.replace(/\/$/, "");
  if (production) return null;
  try {
    return originFromHeaders(await headers());
  } catch {
    return "http://localhost:3000"; // no request in scope
  }
}
