import "server-only";

// The origin a request arrived on, from its proxy headers. Only for links sent
// back to the person who made the request (the publish blast is the admin's
// own); a link other people will click comes from APP_URL (report-alert.ts).
export function originFromHeaders(h: Headers): string {
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
