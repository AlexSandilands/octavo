// CSRF guard for the admin route handlers: the request has to have been made by
// a page on this site. Server Actions carry Next's own origin check; a plain
// route handler does not, and the session cookie alone would let any origin
// drive one. Every admin route that mutates or exports uses this.
//
// A cross-origin form POST sends `Origin` and cannot forge `Host`, so comparing
// them is the whole test. An absent `Origin` is refused rather than trusted.
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
