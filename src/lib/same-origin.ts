// CSRF guard for the admin route handlers, which get none of the origin checking
// Server Actions have. A cross-origin request sends `Origin` and cannot forge
// `Host`; an absent `Origin` is refused rather than trusted.
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    const url = new URL(origin);
    return /^https?:$/.test(url.protocol) && url.host === host;
  } catch {
    return false;
  }
}
