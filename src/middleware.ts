import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/next-path";

// Edge gate for the members-only routes. It only checks for the *presence* of a
// session cookie — it runs on the Edge runtime and can't reach Postgres to
// validate a database session, so the in-component gates (requireMember /
// requireAdmin in src/server/session.ts) stay the authority. Its jobs are:
//   1. issue the sign-in redirect before any HTML streams, so signed-out
//      visitors never see a flash of the route's loading skeleton (issue #5),
//   2. carry the destination as ?next= so the emailed link returns members to
//      the page they clicked.
// A present-but-stale cookie passes here and is caught by the server gate.

// Auth.js names the cookie differently by transport: dev (HTTP) uses the bare
// name, production (HTTPS) the __Secure- prefix. Check both.
const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

function hasSessionCookie(req: NextRequest): boolean {
  return SESSION_COOKIES.some((name) => req.cookies.has(name));
}

export function middleware(req: NextRequest) {
  if (hasSessionCookie(req)) return NextResponse.next();

  const { pathname, search } = req.nextUrl;
  const signin = new URL("/signin", req.url);

  // Member routes carry the return path; /admin mirrors requireAdminOrRedirect,
  // which redirects to a bare /signin. safeNextPath is defence-in-depth — the
  // path is our own request URL, but it strips control chars and rejects the
  // library root (which needs no ?next=), matching the server gate.
  if (!pathname.startsWith("/admin")) {
    const next = safeNextPath(pathname + search);
    if (next !== "/") signin.searchParams.set("next", next);
  }

  return NextResponse.redirect(signin, 307);
}

// Gated routes only. Everything else — /signin, /api (own auth), _next, static
// assets — is left untouched.
export const config = {
  matcher: ["/", "/read/:path*", "/admin/:path*"],
};
